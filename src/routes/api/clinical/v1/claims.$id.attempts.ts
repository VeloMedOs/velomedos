import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/clinical/v1/claims/:id/attempts
 *
 * Phase 9 — paginated history of NPHIES submission attempts for a claim.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/attempts")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, [
          "biller", "case_manager", "physician", "registrar",
        ]);
        if (!auth.ok) return auth.res;

        const owned = await loadOwned<{ tenant_id: string }>(
          "claim", params.id, auth.ctx.tenantId, "id, tenant_id",
        );
        if (!owned.ok) return owned.res;

        const db = serviceClient() as any;
        const { data, error } = await db
          .from("claim_submission_attempt")
          .select("*")
          .eq("claim_id", params.id)
          .order("attempt_no", { ascending: false })
          .limit(50);
        if (error) return envelope("database_error", "db_error", 400);
        return jsonData({ data });
      },
    },
  },
});