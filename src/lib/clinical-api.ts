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

  // Masters
  listMaster: (resource: string) =>
    clinicalFetch<{ data: any[] }>(`/api/clinical/v1/masters/${resource}`),
  createMaster: (resource: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/masters/${resource}`, { method: "POST", body }),
  updateMaster: (resource: string, id: string, body: unknown) =>
    clinicalFetch<{ data: any }>(`/api/clinical/v1/masters/${resource}/${id}`, { method: "PATCH", body }),
  deleteMaster: (resource: string, id: string) =>
    clinicalFetch<unknown>(`/api/clinical/v1/masters/${resource}/${id}`, { method: "DELETE" }),
};