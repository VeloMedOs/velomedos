import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { EncounterCreate } from "@/lib/mds/schema/encounter";
import { envelope, jsonData, parseBody } from "./_helpers";

const parseCreate = parseBody((raw) => EncounterCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const beneficiaryId = url.searchParams.get("beneficiary_id");
        const status = url.searchParams.get("status");
        const journey = url.searchParams.get("journey_state");
        const cls = url.searchParams.get("class");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

        const db = serviceClient();
        let q = db.from("encounter")
          .select("*", { count: "exact" })
          .eq("tenant_id", auth.ctx.tenantId)
          .order("period_start", { ascending: false })
          .range(offset, offset + limit - 1);
        if (beneficiaryId) q = q.eq("beneficiary_id", beneficiaryId);
        if (status) q = q.eq("status", status);
        if (journey) q = q.eq("journey_state", journey);
        if (cls) q = q.eq("class", cls);
        if (from) q = q.gte("period_start", from);
        if (to) q = q.lte("period_start", to);

        const { data, count, error } = await q;
        if (error) return envelope(error.message, "db_error", 500);
        return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
      },
      POST: async ({ request }) => {
        const auth = await requireClinicalRole(request, ["registrar", "nurse", "physician"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        const { data: ben } = await db.from("beneficiary").select("id, tenant_id")
          .eq("id", parsed.data.beneficiary_id).maybeSingle();
        if (!ben || ben.tenant_id !== auth.ctx.tenantId) {
          return envelope("Beneficiary not found", "not_found", 404);
        }
        if (parsed.data.episode_of_care_id) {
          const { data: ep } = await db.from("episode_of_care").select("id, tenant_id")
            .eq("id", parsed.data.episode_of_care_id).maybeSingle();
          if (!ep || ep.tenant_id !== auth.ctx.tenantId) {
            return envelope("Episode of care not found", "not_found", 404);
          }
        }
        if (parsed.data.coverage_id) {
          const { data: cov } = await db.from("coverage").select("id, tenant_id")
            .eq("id", parsed.data.coverage_id).maybeSingle();
          if (!cov || cov.tenant_id !== auth.ctx.tenantId) {
            return envelope("Coverage not found", "not_found", 404);
          }
        }

        const { data, error } = await db.from("encounter").insert({
          ...parsed.data,
          tenant_id: auth.ctx.tenantId,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
          encounter_number: "", // populated by encounter_set_number BEFORE INSERT trigger
        }).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter.create", "encounter", data.id, {
          class: data.class, reimbursement_model: data.reimbursement_model,
        });
        return jsonData({ data }, 201);
      },
    },
  },
});