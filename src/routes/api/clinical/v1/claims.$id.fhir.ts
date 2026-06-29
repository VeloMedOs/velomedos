import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalRole } from "@/lib/api-clinical";
import { buildClaimBundle } from "@/lib/mds/fhir/claim";
import { envelope, jsonData, loadOwned } from "./_helpers";

/**
 * GET /api/clinical/v1/claims/:id/fhir
 *
 * Returns the FHIR R4 transaction Bundle for the claim — the same payload
 * that will be posted to NPHIES in Phase 9.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/fhir")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, [
          "biller",
          "coder",
          "case_manager",
          "read_only",
        ]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>(
          "claim",
          params.id,
          auth.ctx.tenantId,
          "id, tenant_id",
        );
        if (!owned.ok) return owned.res;
        try {
          const bundle = await buildClaimBundle(params.id);
          return jsonData(bundle);
        } catch (e) {
          return envelope(e instanceof Error ? e.message : "bundle failed", "fhir_error", 500);
        }
      },
    },
  },
});