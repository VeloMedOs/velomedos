import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { SupportingInfoUpdate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseUpdate = parseBody((raw) => SupportingInfoUpdate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/supporting-info/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      PATCH: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["physician", "nurse", "coder"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("clinical_supporting_info", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const parsed = await parseUpdate(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        const { data, error } = await db.from("clinical_supporting_info")
          .update({ ...parsed.data, updated_by: auth.ctx.userId })
          .eq("id", params.id).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "clinical_supporting_info.update", "clinical_supporting_info", params.id);
        return jsonData({ data });
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["physician", "coder"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("clinical_supporting_info", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const db = serviceClient();
        const { error } = await db.from("clinical_supporting_info").delete().eq("id", params.id);
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "clinical_supporting_info.delete", "clinical_supporting_info", params.id);
        return jsonData({ deleted: true });
      },
    },
  },
});