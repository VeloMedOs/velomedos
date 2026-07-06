import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit, preflight, requireClinicalModule, serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "./_helpers";
import { applyEvent } from "@/lib/rcm/eligibility-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/clinical/v1/policy-activations/:id/activate
 * Marks the activation request as activated and moves the linked
 * visit_eligibility to `insured` (locking financial_type=insurance).
 */
export const Route = createFileRoute("/api/clinical/v1/policy-activations/$id/activate")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "reg.activation" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("policy_activation_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      if (owned.row.status === "activated") {
        return envelope("Already activated", "already_activated", 409);
      }
      const db = serviceClient() as any;
      const { data, error } = await db.from("policy_activation_request").update({
        status: "activated",
        activated_by: auth.ctx.userId,
        activated_at: new Date().toISOString(),
        notify_reception_at: new Date().toISOString(),
        updated_by: auth.ctx.userId,
      }).eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 500);
      const moved = await applyEvent(owned.row.visit_eligibility_id,
        { kind: "activation.complete" },
        { userId: auth.ctx.userId, tenantId: auth.ctx.tenantId });
      if (!moved.ok) return envelope(moved.error, moved.code, moved.status ?? 409);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId,
        "policy_activation_request.activate", "policy_activation_request", params.id);
      return jsonData({ data: { request: data, visit_eligibility: moved.row } });
    },
  } },
});