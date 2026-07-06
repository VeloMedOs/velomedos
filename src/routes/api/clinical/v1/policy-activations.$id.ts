import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit, preflight, requireClinicalModule, serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";
import { PolicyActivationUpdate } from "@/lib/mds/schema/rcm";

/* eslint-disable @typescript-eslint/no-explicit-any */
const parsePatch = parseBody((raw) => PolicyActivationUpdate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/policy-activations/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility");
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("policy_activation_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      return jsonData({ data: owned.row });
    },
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "reg.activation" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("policy_activation_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parsePatch(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("policy_activation_request")
        .update({ ...parsed.data, updated_by: auth.ctx.userId })
        .eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId,
        "policy_activation_request.update", "policy_activation_request", params.id);
      return jsonData({ data });
    },
  } },
});