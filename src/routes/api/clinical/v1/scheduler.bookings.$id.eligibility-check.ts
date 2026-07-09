import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { bounce, ok } from "@/lib/rcm/scheduler";
import { runCheck } from "@/lib/rcm/eligibility-engine";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type SchedulerCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
export type RunCheckFn = typeof runCheck;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Step 3 · Turn 4 — pure fixture-friendly handler. Accepts an injected
 * `runCheckFn` so fixtures can stub the NPHIES `submitEligibility` call. */
export async function handlePOST(args: {
  params: { id: string };
  ctx: SchedulerCtx;
  db?: any;
  runCheckFn?: RunCheckFn;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const runFn: RunCheckFn = args.runCheckFn ?? runCheck;
  const { params, ctx } = args;

  const { data: booking } = await db.from("clinic_bookings")
    .select("id, tenant_id, beneficiary_id, coverage_id, eligibility_check_pending")
    .eq("id", params.id).maybeSingle();
  if (!booking || booking.tenant_id !== ctx.tenantId) return bounce("NOT_FOUND");
  if (!booking.coverage_id) return bounce("NO_COVERAGE_FOR_ELIGIBILITY");
  if (!booking.beneficiary_id) return bounce("NOT_FOUND");

  const result = await runFn({
    encounterId: null,
    beneficiaryId: booking.beneficiary_id,
    coverageId: booking.coverage_id,
    ctx: { userId: ctx.userId, tenantId: ctx.tenantId },
  });

  await db.from("clinic_bookings").update({
    eligibility_check_pending: false,
    eligibility_checked_at: new Date().toISOString(),
    eligibility_response: result,
  }).eq("id", params.id);

  return ok({ eligibility_response: result });
}

/**
 * POST /api/clinical/v1/scheduler/bookings/:id/eligibility-check
 *
 * The ONLY scheduling caller of the eligibility engine (which wraps
 * `submitEligibility`). Runs the NPHIES check for the booking's coverage,
 * clears `eligibility_check_pending`, and writes the response back.
 */
export const Route = createFileRoute("/api/clinical/v1/scheduler/bookings/$id/eligibility-check")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.eligibility.run" });
      if (!auth.ok) return auth.res;
      return handlePOST({ params: { id: params.id }, ctx: auth.ctx });
    },
  } },
});