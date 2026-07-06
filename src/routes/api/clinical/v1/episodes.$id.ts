import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { EpisodeOfCareUpdate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseUpdate = parseBody((raw) => EpisodeOfCareUpdate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/episodes/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("episode_of_care", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        return jsonData({ data: owned.row });
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["case_manager", "physician"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("episode_of_care", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const parsed = await parseUpdate(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        const { data, error } = await db.from("episode_of_care")
          .update({ ...parsed.data, updated_by: auth.ctx.userId })
          .eq("id", params.id).select("*").single();
        if (error) return envelope("database_error", "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "episode_of_care.update", "episode_of_care", params.id);
        return jsonData({ data });
      },
    },
  },
});