import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/clinical/v1/claims/:id/ready
 *
 * Transitions a draft claim → ready (biller QA gate before submission).
 * Triggers encounter journey advance to `claim_ready` via the DB trigger.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/ready")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["biller", "case_manager"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string; status: string }>(
          "claim",
          params.id,
          auth.ctx.tenantId,
          "id, tenant_id, status",
        );
        if (!owned.ok) return owned.res;
        if (owned.row.status !== "draft") {
          return envelope(
            `Claim cannot transition to ready from ${owned.row.status}`,
            "bad_status",
            409,
          );
        }
        const db = serviceClient() as any;
        const { data, error } = await db
          .from("claim")
          .update({ status: "ready", updated_by: auth.ctx.userId })
          .eq("id", params.id)
          .select("*")
          .single();
        if (error) return envelope(error.message, "db_error", 400);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "claim.ready", "claim", params.id);
        return jsonData({ data });
      },
    },
  },
});