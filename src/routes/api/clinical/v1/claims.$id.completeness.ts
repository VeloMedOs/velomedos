import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalRole } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";
import { loadClaimReadinessBundle } from "@/lib/mds/claim-loader";
import { validateClaimReadiness } from "@/lib/mds/validation";
import { validateClaimRcmReadiness } from "@/lib/rcm/validation";

/**
 * GET /api/clinical/v1/claims/:id/completeness
 *
 * Phase 10 — read-only readiness probe. Returns clinical (MDS/DRG) and RCM
 * missing items grouped by stage. The provider UI calls this on every edit
 * to drive the "Why is this claim blocked?" panel.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/completeness")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, [
          "coder",
          "physician",
          "biller",
          "case_manager",
        ]);
        if (!auth.ok) return auth.res;

        const loaded = await loadClaimReadinessBundle(params.id, auth.ctx.tenantId);
        if (!loaded.ok) return envelope(loaded.reason, "not_found", 404);

        const clinical = validateClaimReadiness(loaded.bundle);
        const rcm = validateClaimRcmReadiness(loaded.bundle);

        return jsonData({
          claim_id: params.id,
          claim_type: loaded.bundle.claim?.claim_type ?? null,
          billing_model: loaded.bundle.claim?.billing_model ?? null,
          ok: clinical.ok && rcm.ok,
          missing: [...clinical.missing, ...rcm.missing],
          drg: clinical.drg,
          rcm: rcm.flags,
        });
      },
    },
  },
});