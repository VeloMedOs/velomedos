/**
 * Thin typed fetch helper for /api/clinical/v1/*.
 * Mirrors admin-fetch.ts but for the clinical data-plane.
 * Standardised error envelope: { error, code, request_id }.
 */
import { supabase } from "@/integrations/supabase/client";

export type ClinicalError = {
  error: string;
  code: string;
  request_id?: string;
  issues?: Array<{ path: string; message: string; code: string }>;
};

export class ClinicalApiError extends Error {
  code: string;
  status: number;
  payload: ClinicalError | null;
  constructor(message: string, status: number, code: string, payload: ClinicalError | null) {
    super(message);
    this.name = "ClinicalApiError";
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

export async function clinicalFetch<T = unknown>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown; tenantId?: string | null },
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (session?.access_token) headers.set("authorization", `Bearer ${session.access_token}`);
  if (init?.tenantId) headers.set("x-tenant-id", init.tenantId);
  let body: BodyInit | undefined;
  if (init?.body !== undefined && init?.body !== null) {
    if (typeof init.body === "string" || init.body instanceof FormData) {
      body = init.body as BodyInit;
    } else {
      headers.set("content-type", "application/json");
      body = JSON.stringify(init.body);
    }
  }
  const res = await fetch(path, { ...init, headers, body });
  const text = await res.text();
  const parsed = text
    ? (() => { try { return JSON.parse(text); } catch { return null; } })()
    : null;
  if (!res.ok) {
    const env = parsed as ClinicalError | null;
    throw new ClinicalApiError(
      env?.error || `HTTP ${res.status}`,
      res.status,
      env?.code || `http_${res.status}`,
      env,
    );
  }
  return parsed as T;
}

// Typed wrappers per resource (loosely typed — server is the contract).
export const ClinicalAPI = {
  me: () => clinicalFetch<{ data: { user_id: string; tenant_id: string; role: string; clinical_role: string | null } }>("/api/clinical/v1/me"),

  // Registration
  listBeneficiaries: (q?: string) =>
    clinicalFetch<{ data: any[]; pagination: { total: number } }>(
      `/api/clinical/v1/beneficiaries${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  createBeneficiary: (body: unknown) =>
    clinicalFetch<{ data: any }>("/api/clinical/v1/beneficiaries", { method: "POST", body }),
  updateBeneficiary: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/beneficiaries/${id}`, { method: "PATCH", body }),
  listCoverage: (beneficiaryId: string) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/beneficiaries/${beneficiaryId}/coverage`),
  createCoverage: (beneficiaryId: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/beneficiaries/${beneficiaryId}/coverage`, { method: "POST", body }),

  // Encounters / episodes
  listEncounters: (params?: { beneficiary_id?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.beneficiary_id) qs.set("beneficiary_id", params.beneficiary_id);
    if (params?.status) qs.set("status", params.status);
    return clinicalFetch<{ data: any[] }>(`/api/clinical/v1/encounters${qs.toString() ? `?${qs}` : ""}`);
  },
  getEncounter: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${id}`),
  createEncounter: (body: unknown) =>
    clinicalFetch<{ data: any }>("/api/clinical/v1/encounters", { method: "POST", body }),
  addDiagnosis: (encId: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/diagnoses`, { method: "POST", body }),
  addVitals: (encId: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/vitals`, { method: "POST", body }),
  updateEncounter: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${id}`, { method: "PATCH", body }),
  listDiagnoses: (encId: string) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/encounters/${encId}/diagnoses`),
  updateDiagnosis: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/diagnoses/${id}`, { method: "PATCH", body }),
  removeDiagnosis: (id: string) =>
    clinicalFetch<unknown>(`/api/clinical/v1/diagnoses/${id}`, { method: "DELETE" }),
  listCharges: (encId: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/charges`),
  getDrg: (encId: string) =>
    clinicalFetch<{ data: { current: any | null; history: any[] } }>(`/api/clinical/v1/encounters/${encId}/drg`),
  checkEligibility: (body: { beneficiary_id: string; coverage_id?: string | null; encounter_id?: string | null }) =>
    clinicalFetch<{ data: any; sandbox?: boolean }>(`/api/clinical/v1/eligibility/check`, { method: "POST", body }),
  listEligibility: (p?: { encounter_id?: string; beneficiary_id?: string; status?: string; financial_type?: string; limit?: number; offset?: number }) => {
    const u = new URLSearchParams();
    Object.entries(p ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") u.set(k, String(v)); });
    const s = u.toString();
    return clinicalFetch<{ data: any[]; pagination?: { total: number } }>(`/api/clinical/v1/eligibility${s ? `?${s}` : ""}`);
  },
  transitionEligibility: (id: string, event:
    | "exception.approve" | "exception.reject"
    | "activation.request" | "activation.complete" | "activation.reject"
    | "select.self_pay" | "cancel",
    reason?: string,
  ) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/eligibility/${id}/transition`, { method: "POST", body: { event, reason } }),
  admit: (encId: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/admit`, { method: "POST", body }),
  discharge: (encId: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/discharge`, { method: "POST", body }),
  code: (encId: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/code`, { method: "POST", body }),
  group: (encId: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/group`, { method: "POST", body: {} }),
  placeLabOrder: (encId: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/orders/lab`, { method: "POST", body }),

  // Claims
  assembleClaim: (encId: string, body: unknown = {}) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/encounters/${encId}/claim`, { method: "POST", body }),
  getClaim: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/claims/${id}`),
  listClaims: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return clinicalFetch<{ data: any[] }>(`/api/clinical/v1/claims${qs}`);
  },
  getClaimFhir: (id: string) =>
    clinicalFetch<unknown>(`/api/clinical/v1/claims/${id}/fhir`),
  markClaimReady: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/claims/${id}/ready`, { method: "POST", body: {} }),
  submitClaim: (id: string, note?: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/claims/${id}/submit`, { method: "POST", body: { note } }),
  getClaimCompleteness: (id: string) =>
    clinicalFetch<{
      claim_id: string;
      claim_type: string | null;
      billing_model: string | null;
      ok: boolean;
      missing: Array<{ code: string; category: string; stage: "mds" | "drg" | "rcm"; message: string; severity: "error" | "warning" }>;
      drg: { required: boolean; present: boolean; grouper_version_ok: boolean; los_ok: boolean; achi_ok: boolean; pdx_match_ok: boolean };
      rcm: { eligibility_ok: boolean; executed_only_ok: boolean; snapshot_locked: boolean; auth_ok: boolean };
    }>(`/api/clinical/v1/claims/${id}/completeness`),

  // R1 — Policy activation & contract change requests
  listPolicyActivations: (p?: { status?: string; visit_eligibility_id?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    Object.entries(p ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{ data: any[]; pagination?: { total: number } }>(
      `/api/clinical/v1/policy-activations${qs ? `?${qs}` : ""}`,
    );
  },
  activatePolicy: (id: string, body: unknown = {}) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/policy-activations/${id}/activate`, { method: "POST", body }),
  patchPolicyActivation: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/policy-activations/${id}`, { method: "PATCH", body }),
  raiseEligibilityException: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/eligibility/${id}/exception`, { method: "POST", body }),
  createContractChangeRequest: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/masters/contract-change-requests`, { method: "POST", body }),
  listContractChangeRequests: (p?: { status?: string; target_table?: string; target_id?: string }) => {
    const q = new URLSearchParams();
    Object.entries(p ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{ data: any[]; pagination?: { total: number } }>(
      `/api/clinical/v1/masters/contract-change-requests${qs ? `?${qs}` : ""}`,
    );
  },
  approveContractChange: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/masters/contract-change-requests/${id}/approve`, { method: "POST", body: {} }),
  applyContractChange: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/masters/contract-change-requests/${id}/apply`, { method: "POST", body: {} }),
  listPayerAgreements: () =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/masters/payer-agreements`),

  // Masters
  listMaster: (resource: string) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/masters/${resource}`),
  createMaster: (resource: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/masters/${resource}`, { method: "POST", body }),
  updateMaster: (resource: string, id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/masters/${resource}/${id}`, { method: "PATCH", body }),
  deleteMaster: (resource: string, id: string) =>
    clinicalFetch<unknown>(`/api/clinical/v1/masters/${resource}/${id}`, { method: "DELETE" }),

  // Phase 11 — VBHC PROMs / PREMs
  listPromInstruments: (params?: { kind?: string; condition?: string }) => {
    const q = new URLSearchParams();
    if (params?.kind) q.set("kind", params.kind);
    if (params?.condition) q.set("condition", params.condition);
    const qs = q.toString();
    return clinicalFetch<{ data: any[] }>(`/api/clinical/v1/prom-instruments${qs ? `?${qs}` : ""}`);
  },
  createPromInstrument: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/prom-instruments`, { method: "POST", body }),

  listPromAssignments: (params?: { beneficiary_id?: string; episode_id?: string; status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{ data: any[]; pagination?: { limit: number; offset: number; total: number } }>(
      `/api/clinical/v1/prom-assignments${qs ? `?${qs}` : ""}`,
    );
  },
  createPromAssignment: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/prom-assignments`, { method: "POST", body }),
  getPromAssignment: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/prom-assignments/${id}`),
  remindPromAssignment: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/prom-assignments/${id}/remind`, { method: "POST", body: {} }),
  respondPromAssignment: (id: string, body: { answers: Record<string, number>; source?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/prom-assignments/${id}/respond`, { method: "POST", body }),
  submitPromAssignment: (id: string) =>
    clinicalFetch<{ ok: boolean; sandbox: boolean; http_status: number; response: any }>(
      `/api/clinical/v1/prom-assignments/${id}/submit`, { method: "POST", body: {} },
    ),

  listPremResponses: (params?: { beneficiary_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{ data: any[] }>(`/api/clinical/v1/prem-responses${qs ? `?${qs}` : ""}`);
  },
  createPremResponse: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/prem-responses`, { method: "POST", body }),

  outcomesSummary: (params?: { condition?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{
      condition: string | null;
      prom: Array<{ month: string; n: number; pcs: number | null; mcs: number | null; composite: number | null }>;
      prem: Array<{ month: string; n: number; composite: number | null; recommend: number | null }>;
      benchmark: { pcs: number | null; mcs: number | null };
    }>(`/api/clinical/v1/outcomes/summary${qs ? `?${qs}` : ""}`);
  },

  // R2 · Authorization
  listAuthRequests: (params?: { status?: string; encounter_id?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{ data: any[]; pagination?: { limit: number; offset: number; total: number } }>(
      `/api/clinical/v1/auth/requests${qs ? `?${qs}` : ""}`,
    );
  },
  createAuthRequest: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/auth/requests`, { method: "POST", body }),
  getAuthRequest: (id: string) =>
    clinicalFetch<{ data: { request: any; items: any[]; attachments: any[]; communications: any[] } }>(
      `/api/clinical/v1/auth/requests/${id}`,
    ),
  patchAuthRequest: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/auth/requests/${id}`, { method: "PATCH", body }),
  submitAuthRequest: (id: string) =>
    clinicalFetch<{ data: any; sandbox: boolean; http_status: number }>(
      `/api/clinical/v1/auth/requests/${id}/submit`, { method: "POST", body: {} },
    ),
  decideAuthRequest: (id: string, body: {
    decision: "approve" | "partial" | "reject";
    reason?: string | null;
    valid_from?: string | null;
    valid_to?: string | null;
    items?: Array<{ id: string; decision?: "approved" | "partial" | "rejected"; approved_quantity?: number | null; benefit_amount_minor?: number | null; reason?: string | null }>;
  }) => clinicalFetch<{ data: any }>(`/api/clinical/v1/auth/requests/${id}/decision`, { method: "POST", body }),
  bulkAuthRequests: (action: "assign_me" | "scrub" | "submit" | "cancel" | "mark_self_pay", ids: string[]) =>
    clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string }> }>(
      `/api/clinical/v1/auth/requests/bulk`, { method: "POST", body: { action, ids } },
    ),
  addAuthAttachment: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/auth/requests/${id}/attachments`, { method: "POST", body }),
  addAuthCommunication: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/auth/requests/${id}/communications`, { method: "POST", body }),

  // R3 · Claims worklist / scrubber / lifecycle
  listClaimsWorklist: (params?: { bucket?: string; status?: string; q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{
      data: any[];
      counts: Record<string, number>;
      pagination: { total: number; limit: number; offset: number };
    }>(`/api/clinical/v1/claims/worklist${qs ? `?${qs}` : ""}`);
  },
  scrubClaim: (id: string, dry_run = false) =>
    clinicalFetch<{ data: { blockers: any[]; warnings: any[]; next_status: string; hash: string; ok: boolean } }>(
      `/api/clinical/v1/claims/${id}/scrub`, { method: "POST", body: { dry_run } },
    ),
  voidClaim: (id: string, reason: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/claims/${id}/void`, { method: "POST", body: { reason } }),
  resubmitClaim: (id: string, reason: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/claims/${id}/resubmit`, { method: "POST", body: { reason } }),
  claimLifecycle: (id: string) =>
    clinicalFetch<{ data: { events: any[]; scrubs: any[]; submissions: any[] } }>(
      `/api/clinical/v1/claims/${id}/lifecycle`,
    ),
  bulkClaims: (
    action: "scrub" | "submit" | "assign_me" | "void",
    ids: string[],
    reason?: string,
  ) => clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string; hash?: string; next_status?: string }> }>(
    `/api/clinical/v1/claims/bulk`, { method: "POST", body: { action, ids, reason } },
  ),

  // R4 · IP / Day-Case accounting
  listIpWorklist: (params?: { bucket?: string; q?: string; limit?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{
      data: any[];
      counts: Record<string, number>;
      pagination: { total: number; limit: number; offset: number };
    }>(`/api/clinical/v1/ip/worklists${qs ? `?${qs}` : ""}`);
  },
  listAdmissionRequests: (params?: { status?: string; encounter_id?: string; q?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{ data: any[]; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/ip/admission-requests${qs ? `?${qs}` : ""}`,
    );
  },
  createAdmissionRequest: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/ip/admission-requests`, { method: "POST", body }),
  getAdmissionRequest: (id: string) =>
    clinicalFetch<{ data: {
      row: any; bucket: string; readiness: { ok: boolean; blockers: Array<{ code: string; message: string; severity: "error" | "warning" }> };
      transfers: any[]; los_extensions: any[]; deposits: any[]; authorizations: any[];
    } }>(`/api/clinical/v1/ip/admission-requests/${id}`),
  ipAdmissionAction: (id: string, body: { action: string; [key: string]: unknown }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/ip/admission-requests/${id}/action`, { method: "POST", body }),
  bulkAdmissionRequests: (action: "assign_me" | "cancel" | "authorize" | "advance_lounge", ids: string[], reason?: string) =>
    clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string }> }>(
      `/api/clinical/v1/ip/admission-requests/bulk`, { method: "POST", body: { action, ids, reason } },
    ),
  listIpDeposits: (params?: { admission_request_id?: string; status?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
    const qs = q.toString();
    return clinicalFetch<{ data: any[]; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/ip/deposits${qs ? `?${qs}` : ""}`,
    );
  },
  createIpDeposit: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/ip/deposits`, { method: "POST", body }),
  updateIpDeposit: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/ip/deposits/${id}`, { method: "PATCH", body }),
  runIpDailyCharges: (run_date?: string) =>
    clinicalFetch<{ data: { run_date: string; results: Array<{ admission_request_id: string; ok: boolean; charges: number; total_minor: number; error?: string }> } }>(
      `/api/clinical/v1/ip/daily-charges`, { method: "POST", body: { run_date } },
    ),
};

/* ─────────────────────── R6 · Deposits / Refunds / Wallet ───────────────── */

const qs = (params?: Record<string, unknown>) => {
  const q = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") q.set(k, String(v)); });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const depositsApi = {
  list: (params?: { bucket?: string; status?: string; type?: string; caution?: string; beneficiary_id?: string; encounter_id?: string; q?: string; limit?: number; offset?: number }) =>
    clinicalFetch<{ data: any[]; counts: Record<string, number>; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/deposits${qs(params)}`,
    ),
  get: (id: string) =>
    clinicalFetch<{ data: { row: any; txns: any[]; attachments: any[] } }>(`/api/clinical/v1/deposits/${id}`),
  create: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits`, { method: "POST", body }),
  patch: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/${id}`, { method: "PATCH", body }),
  apply: (id: string, body: { amount_minor: number; claim_id: string; reason?: string; receipt_no?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/${id}/apply`, { method: "POST", body }),
  transfer: (id: string, body: { amount_minor: number; target_encounter_id?: string; target_beneficiary_id?: string; reason: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/${id}/transfer`, { method: "POST", body }),
  addAttachment: (id: string, body: { kind: string; url: string; note?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/${id}/attachments`, { method: "POST", body }),
  bulk: (action: "approve" | "release_hold" | "erp_repost" | "cancel", ids: string[], reason?: string) =>
    clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string }> }>(
      `/api/clinical/v1/deposits/bulk`, { method: "POST", body: { action, ids, reason } },
    ),
  availability: (beneficiaryId: string, encounterId?: string | null) =>
    clinicalFetch<{ data: { available_minor: number; deposits: any[] } }>(
      `/api/clinical/v1/deposits/availability${qs({ beneficiary_id: beneficiaryId, encounter_id: encounterId ?? undefined })}`,
    ),
};

export const refundsApi = {
  list: (params?: { bucket?: string; status?: string; deposit_id?: string; limit?: number; offset?: number }) =>
    clinicalFetch<{ data: any[]; counts: Record<string, number>; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/deposits/refund-requests${qs(params)}`,
    ),
  get: (id: string) =>
    clinicalFetch<{ data: { row: any; attachments: any[] } }>(`/api/clinical/v1/deposits/refund-requests/${id}`),
  create: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/refund-requests`, { method: "POST", body }),
  approve: (id: string, body: { approval_reason?: string; approval_level?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/refund-requests/${id}/action`, { method: "POST", body: { action: "approve", ...body } }),
  reject: (id: string, body: { reason: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/refund-requests/${id}/action`, { method: "POST", body: { action: "reject", ...body } }),
  execute: (id: string, body: { receipt_no?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/refund-requests/${id}/action`, { method: "POST", body: { action: "execute", ...body } }),
  bulk: (action: "approve" | "reject" | "execute", ids: string[], reason?: string) =>
    clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string }> }>(
      `/api/clinical/v1/deposits/refund-requests/bulk`, { method: "POST", body: { action, ids, reason } },
    ),
};

export const walletApi = {
  get: (beneficiaryId: string) =>
    clinicalFetch<{ data: { wallet: any | null; txns: any[] } }>(`/api/clinical/v1/deposits/wallets/${beneficiaryId}`),
};

export const creditNotesApi = {
  list: (params?: { beneficiary_id?: string; encounter_id?: string; status?: string; limit?: number; offset?: number }) =>
    clinicalFetch<{ data: any[]; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/deposits/credit-notes${qs(params)}`,
    ),
  create: (body: { beneficiary_id: string; encounter_id?: string; amount_minor: number; reason: string; source_charge_ref?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/credit-notes`, { method: "POST", body }),
  void: (id: string, reason: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/deposits/credit-notes/${id}/void`, { method: "POST", body: { reason } }),
};

export const erpPostingApi = {
  list: (params?: { status?: string; entity_type?: string; limit?: number; offset?: number }) =>
    clinicalFetch<{ data: any[]; counts: Record<string, number>; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/deposits/erp-posting${qs(params)}`,
    ),
  bulk: (action: "retry" | "mark_dead" | "mark_posted", ids: string[]) =>
    clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string }> }>(
      `/api/clinical/v1/deposits/erp-posting/bulk`, { method: "POST", body: { action, ids } },
    ),
};

// -----------------------------------------------------------------------------
// R7 · Cash · ZATCA · Interfaces
// -----------------------------------------------------------------------------

export const cashSessionsApi = {
  list: (params?: { status?: string; drawer_id?: string; opened_by?: string; limit?: number; offset?: number }) =>
    clinicalFetch<{ data: any[]; counts: Record<string, number>; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/cash/sessions${qs(params)}`,
    ),
  get: (id: string) =>
    clinicalFetch<{ data: { session: any; txns: any[]; collections: any[] } }>(`/api/clinical/v1/cash/sessions/${id}`),
  open: (body: { drawer_id?: string; opening_float_minor?: number; note?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/cash/sessions`, { method: "POST", body }),
  close: (id: string, body: { counted_minor: Record<string, number>; note?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/cash/sessions/${id}/close`, { method: "POST", body }),
  reconcile: (id: string, body: { reason?: string }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/cash/sessions/${id}/reconcile`, { method: "POST", body }),
};

export const cashCollectionsApi = {
  list: (params?: {
    bucket?: string; status?: string; method?: string; session_id?: string;
    encounter_id?: string; claim_id?: string; q?: string; limit?: number; offset?: number;
  }) =>
    clinicalFetch<{ data: any[]; counts: Record<string, number>; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/cash/collections${qs(params)}`,
    ),
  get: (id: string) =>
    clinicalFetch<{ data: { row: any; allocations: any[]; deposit_txns: any[] } }>(`/api/clinical/v1/cash/collections/${id}`),
  create: (body: {
    encounter_id?: string; claim_id?: string; beneficiary_id: string;
    method: string; details?: Record<string, unknown>;
    lines: Array<{ description: string; taxable_minor: number; vat_rate: number; discount_minor?: number }>;
    deposit_ids?: string[]; credit_note_ids?: string[]; wallet_apply_minor?: number;
    session_id?: string;
  }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/cash/collections`, { method: "POST", body }),
  post: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/cash/collections/${id}/post`, { method: "POST", body: {} }),
  void: (id: string, reason: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/cash/collections/${id}/void`, { method: "POST", body: { reason } }),
  bulk: (action: "post" | "void" | "print_receipt" | "reissue_zatca", ids: string[], reason?: string) =>
    clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string }> }>(
      `/api/clinical/v1/cash/collections/bulk`, { method: "POST", body: { action, ids, reason } },
    ),
};

export const cashRefundsApi = {
  create: (body: {
    original_collection_id?: string; deposit_id?: string;
    reason_code: string; refund_method: string; details?: Record<string, unknown>;
    lines: Array<{ description: string; amount_minor: number; vat_rate: number }>;
    has_taxed_invoice?: boolean;
  }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/cash/refunds`, { method: "POST", body }),
};

export const taxInvoicesApi = {
  list: (params?: {
    bucket?: string; status?: string; type?: string; encounter_id?: string;
    claim_id?: string; buyer_id?: string; q?: string; limit?: number; offset?: number;
  }) =>
    clinicalFetch<{ data: any[]; counts: Record<string, number>; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/tax-invoices${qs(params)}`,
    ),
  get: (id: string) =>
    clinicalFetch<{ data: { invoice: any; lines: any[]; parent?: any; children: any[] } }>(`/api/clinical/v1/tax-invoices/${id}`),
  issue: (body: {
    invoice_type: "b2b_insurance" | "b2c_patient" | "direct_company" | "credit_note" | "debit_note";
    encounter_id?: string; claim_id?: string; buyer_id?: string;
    lines: Array<{ description: string; qty?: number; unit_price_minor: number; discount_minor?: number; vat_rate?: 0 | 15; reporting_code?: string }>;
    parent_invoice_id?: string; reason?: string;
  }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/tax-invoices`, { method: "POST", body }),
  submitZatca: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/tax-invoices/${id}/submit`, { method: "POST", body: {} }),
  reprint: (id: string) =>
    clinicalFetch<{ data: { pdf_url: string; qr_tlv_base64: string } }>(`/api/clinical/v1/tax-invoices/${id}/reprint`, { method: "POST", body: {} }),
  creditNote: (id: string, body: { reason: string; lines?: Array<{ description: string; amount_minor: number; vat_rate: number }> }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/tax-invoices/${id}/credit-note`, { method: "POST", body }),
  bulk: (action: "submit" | "reprint" | "cancel", ids: string[], reason?: string) =>
    clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string }> }>(
      `/api/clinical/v1/tax-invoices/bulk`, { method: "POST", body: { action, ids, reason } },
    ),
};

export const interfaceLogApi = {
  list: (params?: {
    interface_name?: string; direction?: string; status?: string;
    correlation_id?: string; from?: string; to?: string; limit?: number; offset?: number;
  }) =>
    clinicalFetch<{ data: any[]; counts: Record<string, number>; pagination: { total: number; limit: number; offset: number } }>(
      `/api/clinical/v1/interfaces/log${qs(params)}`,
    ),
  get: (id: string) =>
    clinicalFetch<{ data: { row: any; siblings: any[] } }>(`/api/clinical/v1/interfaces/log/${id}`),
  retry: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/interfaces/log/${id}/retry`, { method: "POST", body: {} }),
  bulk: (action: "retry" | "mark_dead", ids: string[]) =>
    clinicalFetch<{ data: Array<{ id: string; ok: boolean; error?: string }> }>(
      `/api/clinical/v1/interfaces/log/bulk`, { method: "POST", body: { action, ids } },
    ),
  d365Summary: (date: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/interfaces/d365/summary${qs({ date })}`),
  postD365Summary: (date: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/interfaces/d365/summary`, { method: "POST", body: { date } }),
};

// -----------------------------------------------------------------------------
// R8 · Clinical spine — gate / admin-config / forms / formulary / referrals
// -----------------------------------------------------------------------------

export type GateViewRow = {
  order_item_table: string;
  order_item_id: string;
  charge_item_id: string;
  encounter_id: string;
  pricing_mode: "insured" | "cash" | string;
  net_minor: number;
  gate_state: "locked" | "released_by_exception" | "billed";
  exception_id: string | null;
  reason_code: string | null;
};

export const gateApi = {
  view: (encounter_id: string) =>
    clinicalFetch<{ data: GateViewRow[] }>(`/api/clinical/v1/gate/view${qs({ encounter_id })}`),
  preview: (charge_id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/gate/preview${qs({ charge_id })}`),
  listExceptions: (params?: { encounter_id?: string; charge_item_id?: string; admission_request_id?: string; open?: boolean }) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/gate/exceptions${qs(params)}`),
  createException: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/gate/exceptions`, { method: "POST", body }),
  patchException: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/gate/exceptions/${id}`, { method: "PATCH", body }),
  reconcileException: (id: string, body: { nphies_approved_minor: number }) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/gate/exceptions/${id}/reconcile`, { method: "POST", body }),
};

export const adminConfigApi = {
  get: (key?: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/admin-config${qs({ key })}`),
  set: (key: string, value: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/admin-config`, { method: "PATCH", body: { key, value } }),
};

export const formsApi = {
  listDefs: (params?: { active?: boolean; category?: string }) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/forms/defs${qs(params)}`),
  getDef: (id: string) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/forms/defs/${id}`),
  upsertDef: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/forms/defs`, { method: "POST", body }),
  listInstances: (params?: { encounter_id?: string; form_def_id?: string; status?: string }) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/forms/instances${qs(params)}`),
  createInstance: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/forms/instances`, { method: "POST", body }),
  patchInstance: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/forms/instances/${id}`, { method: "PATCH", body }),
  listBindings: (params?: { form_def_id?: string; active?: boolean }) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/forms/bindings${qs(params)}`),
  upsertBinding: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/forms/bindings`, { method: "POST", body }),
};

export const formularyApi = {
  import: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/formulary/import`, { method: "POST", body }),
  listIndications: (params?: { drug_id?: string; active?: boolean }) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/formulary/indications${qs(params)}`),
  createIndication: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/formulary/indications`, { method: "POST", body }),
  patchIndication: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/formulary/indications/${id}`, { method: "PATCH", body }),
  deleteIndication: (id: string) =>
    clinicalFetch<unknown>(`/api/clinical/v1/formulary/indications/${id}`, { method: "DELETE" }),
};

export const referralsApi = {
  list: (params?: { encounter_id?: string; status?: string; limit?: number; offset?: number }) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/referrals${qs(params)}`),
  create: (body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/referrals`, { method: "POST", body }),
  patch: (id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/referrals/${id}`, { method: "PATCH", body }),
  listTargets: (id: string) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/referrals/${id}/targets`),
};