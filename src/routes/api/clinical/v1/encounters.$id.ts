import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { EncounterUpdate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseUpdate = parseBody((raw) => EncounterUpdate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const db = serviceClient();
        const [ct, dx] = await Promise.all([
          db.from("encounter_care_team").select("*").eq("encounter_id", params.id),
          db.from("encounter_diagnosis").select("id", { count: "exact", head: true }).eq("encounter_id", params.id),
        ]);
        return jsonData({
          data: owned.row,
          care_team: ct.data ?? [],
          diagnosis_count: dx.count ?? 0,
        });
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["registrar", "nurse", "physician", "case_manager"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const parsed = await parseUpdate(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        const { data, error } = await db.from("encounter")
          .update({ ...parsed.data, updated_by: auth.ctx.userId })
          .eq("id", params.id).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter.update", "encounter", params.id);
        return jsonData({ data });
      },
    },
  },
});