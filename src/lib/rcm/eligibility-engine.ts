/**
 * RCM Phase R1 — Eligibility orchestrator.
 *
 * Bridges the pure state-machine in `eligibility-sm.ts` to:
 *  - persistence (visit_eligibility, eligibility_exception, policy_activation_request)
 *  - the shared Phase-9 NPHIES gateway (`submitEligibility`)
 *  - audit + ops notifications
 *
 * All functions accept a tenant-scoped context and return the next row.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { serviceClient, clinicalAudit } from "@/lib/api-clinical";
import { submitEligibility } from "@/lib/mds/nphies/gateway";
import { parseEligibility } from "@/lib/mds/fhir/claim-response";
import { beneficiaryToFhirPatient } from "@/lib/mds/fhir/patient";
import { coverageToFhirCoverage } from "@/lib/mds/fhir/coverage";
import {
  transition,
  type EligibilityEvent,
  type EligibilityStatus,
  type Transition,
} from "./eligibility-sm";

export type ActorCtx = { userId: string; tenantId: string };

const urn = () => `urn:uuid:${crypto.randomUUID()}`;

async function buildCoverageEligibilityBundle(coverageId: string): Promise<any> {
  const db = serviceClient() as any;
  const { data: coverage } = await db.from("coverage").select("*").eq("id", coverageId).maybeSingle();
  if (!coverage) throw new Error("coverage_not_found");
  const { data: beneficiary } = await db
    .from("beneficiary").select("*").eq("id", coverage.beneficiary_id).maybeSingle();
  const { data: classes } = await db
    .from("coverage_class").select("*").eq("coverage_id", coverage.id);

  const patientUrn = urn();
  const coverageUrn = urn();
  const reqUrn = urn();

  return {
    resourceType: "Bundle",
    type: "transaction",
    timestamp: new Date().toISOString(),
    entry: [
      { fullUrl: patientUrn, resource: beneficiaryToFhirPatient(beneficiary),
        request: { method: "PUT", url: `Patient/${beneficiary.id}` } },
      { fullUrl: coverageUrn, resource: coverageToFhirCoverage(coverage, classes ?? [], patientUrn),
        request: { method: "PUT", url: `Coverage/${coverage.id}` } },
      { fullUrl: reqUrn, resource: {
          resourceType: "CoverageEligibilityRequest",
          status: "active",
          purpose: ["benefits", "validation"],
          patient: { reference: patientUrn },
          created: new Date().toISOString(),
          insurer: { display: "Payer" },
          provider: { display: "Provider" },
          insurance: [{ focal: true, coverage: { reference: coverageUrn } }],
        },
        request: { method: "POST", url: "CoverageEligibilityRequest" } },
    ],
  };
}

async function applyEffects(
  row: any,
  next: EligibilityStatus,
  trans: Extract<Transition, { ok: true }>,
  ctx: ActorCtx,
) {
  const db = serviceClient() as any;
  const patch: Record<string, unknown> = {
    status: next,
    reason: trans.reason ?? row.reason,
    updated_by: ctx.userId,
  };
  for (const eff of trans.effects) {
    if (eff.kind === "lock_financial_type") patch.financial_type = eff.value;
  }
  const { data: saved } = await db.from("visit_eligibility")
    .update(patch).eq("id", row.id).select("*").single();

  for (const eff of trans.effects) {
    if (eff.kind === "notify") {
      try {
        await db.from("ops_notifications").insert({
          tenant_id: ctx.tenantId,
          audience_tenant_id: ctx.tenantId,
          topic: eff.topic,
          severity: "info",
          title: `Eligibility ${next}`,
          body: `Visit ${row.encounter_id ?? row.id}: ${eff.topic}`,
          payload: { visit_eligibility_id: row.id, status: next, reason: trans.reason ?? null },
        });
      } catch { /* notifications never block the SM */ }
    }
  }
  await clinicalAudit(
    ctx.userId, ctx.tenantId,
    `eligibility.${next}`, "visit_eligibility", row.id,
    { from: row.status, reason: trans.reason ?? null },
  );
  return saved ?? row;
}

/**
 * Apply an event to a visit_eligibility row.
 * Loads the row tenant-scoped, runs the SM, persists + emits effects.
 */
export async function applyEvent(
  rowId: string,
  event: EligibilityEvent,
  ctx: ActorCtx,
): Promise<{ ok: true; row: any } | { ok: false; error: string; code: string; status?: number }> {
  const db = serviceClient() as any;
  const { data: row } = await db.from("visit_eligibility")
    .select("*").eq("id", rowId).eq("tenant_id", ctx.tenantId).maybeSingle();
  if (!row) return { ok: false, error: "visit_eligibility not found", code: "not_found", status: 404 };
  const t = transition(row.status as EligibilityStatus, event);
  if (!t.ok) return { ok: false, error: t.error, code: t.code, status: 409 };
  const saved = await applyEffects(row, t.next, t, ctx);
  return { ok: true, row: saved };
}

/**
 * Run a CHI/NPHIES eligibility check for an encounter and capture the
 * outcome. Creates a visit_eligibility row on first call, updates it on
 * subsequent calls. Returns the persisted row.
 */
export async function runCheck(args: {
  encounterId?: string | null;
  beneficiaryId: string;
  coverageId?: string | null;
  ctx: ActorCtx;
}): Promise<{ ok: true; row: any; sandbox: boolean } | { ok: false; error: string; code: string; status?: number }> {
  const db = serviceClient() as any;

  // Find or create the visit_eligibility row.
  let row: any = null;
  if (args.encounterId) {
    const { data } = await db.from("visit_eligibility")
      .select("*").eq("tenant_id", args.ctx.tenantId).eq("encounter_id", args.encounterId)
      .neq("status", "cancelled").maybeSingle();
    row = data;
  }
  if (!row) {
    const insert: any = {
      tenant_id: args.ctx.tenantId,
      encounter_id: args.encounterId ?? null,
      beneficiary_id: args.beneficiaryId,
      status: "new",
      financial_type: args.coverageId ? "pending" : "self_pay",
      created_by: args.ctx.userId,
      updated_by: args.ctx.userId,
    };
    const { data, error } = await db.from("visit_eligibility").insert(insert).select("*").single();
    if (error) return { ok: false, error: error.message, code: "db_error", status: 500 };
    row = data;
  }

  if (!args.coverageId) {
    // No coverage to check — transition straight to self_pay.
    const t = transition(row.status as EligibilityStatus, { kind: "select.self_pay", reason: "no_coverage" });
    if (!t.ok) return { ok: false, error: t.error, code: t.code, status: 409 };
    const saved = await applyEffects(row, t.next, t, args.ctx);
    return { ok: true, row: saved, sandbox: true };
  }

  // 1. move to checking
  const start = transition(row.status as EligibilityStatus, { kind: "check.start" });
  if (!start.ok) return { ok: false, error: start.error, code: start.code, status: 409 };
  row = await applyEffects(row, start.next, start, args.ctx);

  // 2. call NPHIES
  let bundle: any;
  try {
    bundle = await buildCoverageEligibilityBundle(args.coverageId);
  } catch (e: any) {
    const err = transition(row.status as EligibilityStatus, { kind: "check.error", reason: e?.message ?? "bundle_error" });
    if (err.ok) row = await applyEffects(row, err.next, err, args.ctx);
    return { ok: false, error: e?.message ?? "bundle_error", code: "bundle_error", status: 500 };
  }
  const idem = `elig:${row.id}:${Date.now()}`;
  const result = await submitEligibility(bundle, idem, args.ctx.tenantId);
  await db.from("visit_eligibility").update({
    result_payload: result.bundle,
    eligibility_ref_no: result.bundle?.entry?.[0]?.resource?.identifier?.[0]?.value ?? null,
    payer_id: row.payer_id,
    checked_at: new Date().toISOString(),
  }).eq("id", row.id);

  if (!result.ok) {
    const err = transition("checking", { kind: "check.error", reason: result.error ?? "gateway_error" });
    if (err.ok) row = await applyEffects(row, err.next, err, args.ctx);
    return { ok: true, row, sandbox: result.sandbox };
  }

  const parsed = parseEligibility(result.bundle);
  const done = transition("checking", { kind: "check.success", inforce: !!parsed.inforce });
  if (done.ok) row = await applyEffects(row, done.next, done, args.ctx);
  return { ok: true, row, sandbox: result.sandbox };
}