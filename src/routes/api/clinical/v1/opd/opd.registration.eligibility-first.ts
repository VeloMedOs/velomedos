import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import { runCheck } from "@/lib/rcm/eligibility-engine";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Body = z.object({
  beneficiary_id: z.string().uuid(),
  visit_type: z.enum(["walk_in","scheduled","referral","emergency","newborn","ip_followup","external","marketing"]).default("walk_in"),
  financial_type: z.enum(["insured","self_pay"]),
  coverage_id: z.string().uuid().nullable().optional(),
});
export type EligibilityFirstBody = z.infer<typeof Body>;

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
export type RunCheckFn = typeof runCheck;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HCA-0065 · JJ3 — eligibility gate BEFORE visit creation.
 *
 * Never delegates to `eligibility.check` for a passive probe: that route
 * mutates the visit to self_pay when coverage_id is omitted. Self-pay is
 * decided by `financial_type` alone here; insured callers MUST provide a
 * coverage_id and only then do we call NPHIES.
 */
export async function handlePOST(args: {
  body: EligibilityFirstBody;
  ctx: OpdCtx;
  db?: any;
  runCheckFn?: RunCheckFn;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { body, ctx } = args;
  const runFn: RunCheckFn = args.runCheckFn ?? runCheck;

  const { data: bene } = await db.from("beneficiary")
    .select("id, tenant_id").eq("id", body.beneficiary_id).maybeSingle();
  if (!bene || bene.tenant_id !== ctx.tenantId) return envelope("beneficiary not found", "not_found", 404);

  if (body.financial_type === "self_pay") {
    return jsonData({ ok: true, data: { path: "self_pay" }, request_id: crypto.randomUUID() });
  }

  if (!body.coverage_id) {
    return envelope("coverage_id required for insured visits", "coverage_required", 422);
  }

  const { data: cov } = await db.from("coverage")
    .select("id, tenant_id").eq("id", body.coverage_id).maybeSingle();
  if (!cov || cov.tenant_id !== ctx.tenantId) return envelope("coverage not found", "not_found", 404);

  const result = await runFn({
    encounterId: null,
    beneficiaryId: body.beneficiary_id,
    coverageId: body.coverage_id,
    ctx: { userId: ctx.userId, tenantId: ctx.tenantId },
  });

  if (result.ok) {
    return jsonData({
      ok: true,
      data: { path: "insured", eligibility_ref: (result as any).row?.id ?? null, sandbox: (result as any).sandbox ?? false },
      request_id: crypto.randomUUID(),
    });
  }

  // Not eligible — exception path for referral/emergency/newborn per 0061d.
  const exceptionTypes = new Set(["referral", "emergency", "newborn"]);
  if (exceptionTypes.has(body.visit_type)) {
    return jsonData({
      ok: true,
      data: { path: "exception", exception: body.visit_type, payer_detail: (result as any).error ?? null },
      request_id: crypto.randomUUID(),
    });
  }

  return envelope("beneficiary not eligible", "not_eligible", 403, { payer_detail: (result as any).error ?? null });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/registration/eligibility-first")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "opd.registration" });
      if (!auth.ok) return auth.res;
      let body: EligibilityFirstBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});