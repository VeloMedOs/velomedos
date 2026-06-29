import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit, preflight, requireClinicalRole, serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute(
  "/api/clinical/v1/masters/contract-change-requests/$id/approve",
)({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin", "rcm"]);
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("contract_change_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      if (owned.row.status !== "draft") {
        return envelope(`Change request must be draft to approve (got ${owned.row.status})`, "invalid_state", 409);
      }
      const db = serviceClient() as any;
      const { data, error } = await db.from("contract_change_request").update({
        status: "approved",
        approved_by: auth.ctx.userId,
        approved_at: new Date().toISOString(),
        updated_by: auth.ctx.userId,
      }).eq("id", params.id).select("*").single();
      if (error) return envelope(error.message, "db_error", 500);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId,
        "contract_change_request.approve", "contract_change_request", params.id);
      return jsonData({ data });
    },
  } },
});