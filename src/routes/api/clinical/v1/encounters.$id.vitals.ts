import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { VitalsCreate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseCreate = parseBody((raw) => VitalsCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/vitals")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId, "id, tenant_id");
        if (!owned.ok) return owned.res;
        const url = new URL(request.url);
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        const db = serviceClient();
        const { data, count, error } = await db.from("vitals_observation")
          .select("*", { count: "exact" })
          .eq("encounter_id", params.id)
          .order("recorded_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return envelope(error.message, "db_error", 500);
        return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
      },
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["nurse", "physician"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string; beneficiary_id: string }>(
          "encounter", params.id, auth.ctx.tenantId, "id, tenant_id, beneficiary_id",
        );
        if (!owned.ok) return owned.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        const { data, error } = await db.from("vitals_observation").insert({
          ...parsed.data,
          encounter_id: params.id,
          beneficiary_id: owned.row.beneficiary_id,
          tenant_id: auth.ctx.tenantId,
          recorded_by: auth.ctx.userId,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        }).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "vitals_observation.create", "vitals_observation", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});