import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit, preflight, requireClinicalRole, serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const ALLOWED_TABLES = new Set([
  "payer", "tpa", "policy", "insurance_class", "insurance_plan",
  "network", "payer_agreement", "price_list", "price_list_item",
]);

export const Route = createFileRoute(
  "/api/clinical/v1/masters/contract-change-requests/$id/apply",
)({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin", "rcm"]);
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("contract_change_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      if (owned.row.status !== "approved") {
        return envelope(`Change request must be approved (got ${owned.row.status})`, "invalid_state", 409);
      }
      if (!ALLOWED_TABLES.has(owned.row.target_table)) {
        return envelope(`Target table ${owned.row.target_table} not allowed`, "invalid_target", 400);
      }
      const db = serviceClient() as any;
      // Defensive hardening — strip protected keys so an apply cannot
      // rewrite id/tenant_id/created_at/created_by with stale snapshot
      // values (audit loss + RLS WITH CHECK hazard).
      const after = { ...(owned.row.after as Record<string, unknown>) };
      delete (after as any).id;
      delete (after as any).tenant_id;
      delete (after as any).created_at;
      delete (after as any).created_by;
      delete (after as any).updated_at; // let touch trigger set now()
      const { error: applyErr } = await db.from(owned.row.target_table)
        .update({ ...after, updated_by: auth.ctx.userId })
        .eq("id", owned.row.target_id)
        .eq("tenant_id", auth.ctx.tenantId);
      if (applyErr) return envelope(applyErr.message, "apply_error", 400);
      const { data, error } = await db.from("contract_change_request").update({
        status: "applied",
        applied_at: new Date().toISOString(),
        updated_by: auth.ctx.userId,
      }).eq("id", params.id).select("*").single();
      if (error) return envelope(error.message, "db_error", 500);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId,
        "contract_change_request.apply", owned.row.target_table, owned.row.target_id,
        { after: owned.row.after });
      return jsonData({ data });
    },
  } },
});