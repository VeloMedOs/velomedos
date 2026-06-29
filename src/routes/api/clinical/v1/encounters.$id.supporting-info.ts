import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { SupportingInfoCreate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseCreate = parseBody((raw) => SupportingInfoCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/supporting-info")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const db = serviceClient();
        const { data, error } = await db.from("clinical_supporting_info")
          .select("*").eq("encounter_id", params.id)
          .order("sequence", { ascending: true, nullsFirst: false })
          .order("recorded_at", { ascending: true });
        if (error) return envelope(error.message, "db_error", 500);
        return jsonData({ data: data ?? [] });
      },
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["physician", "nurse", "coder"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string; beneficiary_id: string }>(
          "encounter", params.id, auth.ctx.tenantId, "id, tenant_id, beneficiary_id",
        );
        if (!owned.ok) return owned.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        const { data, error } = await db.from("clinical_supporting_info").insert({
          ...parsed.data,
          encounter_id: params.id,
          beneficiary_id: owned.row.beneficiary_id,
          tenant_id: auth.ctx.tenantId,
          recorded_by: auth.ctx.userId,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        }).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "clinical_supporting_info.create", "clinical_supporting_info", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});