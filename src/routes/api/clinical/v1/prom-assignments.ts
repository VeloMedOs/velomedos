import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { z } from "zod";

const Create = z.object({
  beneficiary_id: z.string().uuid(),
  episode_of_care_id: z.string().uuid().optional(),
  encounter_id: z.string().uuid().optional(),
  instrument_id: z.string().uuid(),
  trigger: z.enum(["pre_op", "post_op", "baseline", "followup"]),
  due_at: z.string().datetime().optional(),
  channel: z.enum(["app", "sms", "portal"]).default("app"),
  notes: z.string().optional(),
});
const parseCreate = parseBody((raw) => Create.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/prom-assignments")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const benId = url.searchParams.get("beneficiary_id");
        const episodeId = url.searchParams.get("episode_id");
        const status = url.searchParams.get("status");
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
        const db = serviceClient();
        let q = db.from("prom_assignment").select("*, prom_instrument(name, kind, condition, version)", { count: "exact" })
          .eq("tenant_id", auth.ctx.tenantId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (benId) q = q.eq("beneficiary_id", benId);
        if (episodeId) q = q.eq("episode_of_care_id", episodeId);
        if (status) q = q.eq("status", status);
        const { data, count, error } = await q;
        if (error) return envelope("database_error", "db_error", 500);
        return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
      },
      POST: async ({ request }) => {
        const auth = await requireClinicalRole(request, ["registrar", "case_manager", "physician", "nurse"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        // beneficiary ownership
        const { data: ben } = await db.from("beneficiary").select("id, tenant_id").eq("id", parsed.data.beneficiary_id).maybeSingle();
        if (!ben || ben.tenant_id !== auth.ctx.tenantId) return envelope("Beneficiary not found", "not_found", 404);
        // instrument: tenant-owned OR platform-seeded
        const { data: inst } = await db.from("prom_instrument").select("id, tenant_id, active").eq("id", parsed.data.instrument_id).maybeSingle();
        if (!inst || (inst.tenant_id !== null && inst.tenant_id !== auth.ctx.tenantId) || !inst.active) {
          return envelope("Instrument not available", "not_found", 404);
        }
        const { data, error } = await db.from("prom_assignment").insert({
          tenant_id: auth.ctx.tenantId,
          beneficiary_id: parsed.data.beneficiary_id,
          episode_of_care_id: parsed.data.episode_of_care_id ?? null,
          encounter_id: parsed.data.encounter_id ?? null,
          instrument_id: parsed.data.instrument_id,
          trigger: parsed.data.trigger,
          due_at: parsed.data.due_at ?? null,
          channel: parsed.data.channel,
          notes: parsed.data.notes ?? null,
          assigned_by: auth.ctx.userId,
        } as never).select("*").single();
        if (error) return envelope("database_error", "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "prom_assignment.create", "prom_assignment", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});