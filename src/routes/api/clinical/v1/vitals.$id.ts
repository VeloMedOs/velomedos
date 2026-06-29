import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { VitalsUpdate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseUpdate = parseBody((raw) => VitalsUpdate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/vitals/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("vitals_observation", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        return jsonData({ data: owned.row });
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["nurse", "physician"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("vitals_observation", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const parsed = await parseUpdate(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        const { data, error } = await db.from("vitals_observation")
          .update({ ...parsed.data, updated_by: auth.ctx.userId })
          .eq("id", params.id).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "vitals_observation.update", "vitals_observation", params.id);
        return jsonData({ data });
      },
    },
  },
});