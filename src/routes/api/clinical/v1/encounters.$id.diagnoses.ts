import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { DiagnosisCreate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseCreate = parseBody((raw) => DiagnosisCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/diagnoses")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const db = serviceClient();
        const { data, error } = await db.from("encounter_diagnosis")
          .select("*")
          .eq("encounter_id", params.id)
          .order("rank", { ascending: true, nullsFirst: false });
        if (error) return envelope("database_error", "db_error", 500);
        return jsonData({ data: data ?? [] });
      },
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["physician", "coder"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        const { data, error } = await db.from("encounter_diagnosis").insert({
          ...parsed.data,
          encounter_id: params.id,
          tenant_id: auth.ctx.tenantId,
          recorded_by: auth.ctx.userId,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        }).select("*").single();
        if (error) return envelope("database_error", "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter_diagnosis.create", "encounter_diagnosis", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});