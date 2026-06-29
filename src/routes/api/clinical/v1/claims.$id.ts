import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalRole } from "@/lib/api-clinical";
import { loadClaim } from "@/lib/mds/claim-assembly";
import { envelope, jsonData, loadOwned } from "./_helpers";

/**
 * GET /api/clinical/v1/claims/:id
 *
 * Returns the full materialised claim (header + items + diagnoses +
 * care team + supporting info + links + pricing_trace).
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, [
          "biller",
          "coder",
          "case_manager",
          "cashier",
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
          const result = await loadClaim(params.id);
          return jsonData({ data: result });
        } catch (e) {
          return envelope(e instanceof Error ? e.message : "load failed", "load_error", 500);
        }
      },
    },
  },
});