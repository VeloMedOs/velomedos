import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { EpisodeOfCareCreate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, parseBody } from "./_helpers";

const parseCreate = parseBody((raw) => EpisodeOfCareCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/episodes")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const beneficiaryId = url.searchParams.get("beneficiary_id");
        const status = url.searchParams.get("status");
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

        const db = serviceClient();
        let q = db.from("episode_of_care")
          .select("*", { count: "exact" })
          .eq("tenant_id", auth.ctx.tenantId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (beneficiaryId) q = q.eq("beneficiary_id", beneficiaryId);
        if (status) q = q.eq("status", status);
        const { data, count, error } = await q;
        if (error) return envelope(error.message, "db_error", 500);
        return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
      },
      POST: async ({ request }) => {
        const auth = await requireClinicalRole(request, ["registrar", "case_manager"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        // verify beneficiary belongs to tenant
        const { data: ben } = await db.from("beneficiary").select("id, tenant_id")
          .eq("id", parsed.data.beneficiary_id).maybeSingle();
        if (!ben || ben.tenant_id !== auth.ctx.tenantId) {
          return envelope("Beneficiary not found", "not_found", 404);
        }
        const { data, error } = await db.from("episode_of_care").insert({
          ...parsed.data,
          tenant_id: auth.ctx.tenantId,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        }).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "episode_of_care.create", "episode_of_care", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});