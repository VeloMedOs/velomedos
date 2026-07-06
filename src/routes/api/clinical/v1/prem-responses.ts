import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { z } from "zod";
import { scoreProm, validateAnswers, type InstrumentSchema, type Answers } from "@/lib/mds/prom-scoring";

const Body = z.object({
  beneficiary_id: z.string().uuid(),
  encounter_id: z.string().uuid().optional(),
  instrument_id: z.string().uuid(),
  answers: z.record(z.string(), z.number()),
  source: z.enum(["patient_app", "sms", "portal", "staff"]).default("portal"),
});
const parsePrem = parseBody((raw) => Body.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/prem-responses")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const benId = url.searchParams.get("beneficiary_id");
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
        const db = serviceClient();
        let q = db.from("prem_response").select("*").eq("tenant_id", auth.ctx.tenantId)
          .order("collected_at", { ascending: false }).limit(limit);
        if (benId) q = q.eq("beneficiary_id", benId);
        const { data, error } = await q;
        if (error) return envelope(error.message, "db_error", 500);
        return jsonData({ data: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const parsed = await parsePrem(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        const { data: ben } = await db.from("beneficiary").select("id, tenant_id").eq("id", parsed.data.beneficiary_id).maybeSingle();
        if (!ben || ben.tenant_id !== auth.ctx.tenantId) return envelope("Beneficiary not found", "not_found", 404);
        const { data: inst } = await db.from("prom_instrument").select("id, version, kind, schema").eq("id", parsed.data.instrument_id).maybeSingle();
        if (!inst) return envelope("Instrument missing", "not_found", 404);
        const schema = inst.schema as unknown as InstrumentSchema;
        const issues = validateAnswers(schema, parsed.data.answers as Answers);
        if (issues.length) return envelope("Answers invalid", "answers_invalid", 422, { issues });
        const score = scoreProm(schema.scoring, parsed.data.answers as Answers);
        const { data, error } = await db.from("prem_response").insert({
          tenant_id: auth.ctx.tenantId,
          beneficiary_id: parsed.data.beneficiary_id,
          encounter_id: parsed.data.encounter_id ?? null,
          instrument_id: parsed.data.instrument_id,
          instrument_version: inst.version,
          answers: parsed.data.answers as unknown,
          score: score as unknown,
          source: parsed.data.source,
        } as never).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "prem_response.create", "prem_response", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});