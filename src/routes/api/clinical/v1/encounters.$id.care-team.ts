import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { CareTeamMemberCreate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseCreate = parseBody((raw) => CareTeamMemberCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/care-team")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const db = serviceClient();
        const { data, error } = await db.from("encounter_care_team")
          .select("*").eq("encounter_id", params.id);
        if (error) return envelope(error.message, "db_error", 500);
        return jsonData({ data: data ?? [] });
      },
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["physician", "case_manager", "tenant_admin"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        const { data: member } = await db.from("tenant_members")
          .select("user_id, tenant_id")
          .eq("user_id", parsed.data.practitioner_user_id)
          .eq("tenant_id", auth.ctx.tenantId)
          .maybeSingle();
        if (!member) return envelope("Practitioner not in tenant", "not_found", 404);

        const { data, error } = await db.from("encounter_care_team").insert({
          ...parsed.data,
          encounter_id: params.id,
          tenant_id: auth.ctx.tenantId,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        }).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter_care_team.create", "encounter_care_team", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});