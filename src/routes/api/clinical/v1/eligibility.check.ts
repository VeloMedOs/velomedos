import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, assertMasterOwnership } from "./_helpers";
import { EligibilityCheckRequest } from "@/lib/mds/schema/rcm";
import { runCheck } from "@/lib/rcm/eligibility-engine";

const parse = parseBody((raw) => EligibilityCheckRequest.parse(raw));

/**
 * POST /api/clinical/v1/eligibility/check
 * Body: { encounter_id?, beneficiary_id, coverage_id? }
 * Creates/updates the visit_eligibility row and fires NPHIES.
 * When coverage_id is omitted, immediately transitions to self_pay.
 */
export const Route = createFileRoute("/api/clinical/v1/eligibility/check")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "reg.eligibility" });
      if (!auth.ok) return auth.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const { beneficiary_id, coverage_id, encounter_id } = parsed.data;
      const bErr = await assertMasterOwnership("beneficiary", beneficiary_id, auth.ctx.tenantId);
      if (bErr) return bErr;
      if (coverage_id) {
        const cErr = await assertMasterOwnership("coverage", coverage_id, auth.ctx.tenantId);
        if (cErr) return cErr;
      }
      if (encounter_id) {
        const eErr = await assertMasterOwnership("encounter", encounter_id, auth.ctx.tenantId);
        if (eErr) return eErr;
      }
      const result = await runCheck({
        encounterId: encounter_id ?? null,
        beneficiaryId: beneficiary_id,
        coverageId: coverage_id ?? null,
        ctx: { userId: auth.ctx.userId, tenantId: auth.ctx.tenantId },
      });
      if (!result.ok) return envelope(result.error, result.code, result.status ?? 400);
      return jsonData({ data: result.row, sandbox: result.sandbox });
    },
  } },
});