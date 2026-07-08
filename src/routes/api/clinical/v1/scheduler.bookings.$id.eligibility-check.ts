import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { bounce, ok } from "@/lib/rcm/scheduler";
import { runCheck } from "@/lib/rcm/eligibility-engine";

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

      const db = serviceClient();
      const { data: booking } = await db.from("clinic_bookings")
        .select("id, tenant_id, beneficiary_id, coverage_id, eligibility_check_pending")
        .eq("id", params.id).maybeSingle();
      if (!booking || booking.tenant_id !== auth.ctx.tenantId) return bounce("NOT_FOUND");
      if (!booking.coverage_id) return bounce("NO_COVERAGE_FOR_ELIGIBILITY");
      if (!booking.beneficiary_id) return bounce("NOT_FOUND");

      const result = await runCheck({
        encounterId: null,
        beneficiaryId: booking.beneficiary_id,
        coverageId: booking.coverage_id,
        ctx: { userId: auth.ctx.userId, tenantId: auth.ctx.tenantId },
      });

      await db.from("clinic_bookings").update({
        eligibility_check_pending: false,
      }).eq("id", params.id);

      return ok({ eligibility_response: result });
    },
  } },
});