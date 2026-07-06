import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { z } from "zod";
import { scoreProm, validateAnswers, type InstrumentSchema, type Answers } from "@/lib/mds/prom-scoring";

const Body = z.object({
  answers: z.record(z.string(), z.number()),
  source: z.enum(["patient_app", "sms", "portal", "staff"]).default("portal"),
});
const parseRespond = parseBody((raw) => Body.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/prom-assignments/$id/respond")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const parsed = await parseRespond(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient();
        const { data: a } = await db.from("prom_assignment")
          .select("id, tenant_id, status, instrument_id, beneficiary_id")
          .eq("id", params.id).maybeSingle();
        if (!a || a.tenant_id !== auth.ctx.tenantId) return envelope("Not found", "not_found", 404);
        if (a.status === "completed") return envelope("Already completed", "already_completed", 409);
        const { data: inst } = await db.from("prom_instrument")
          .select("id, version, schema").eq("id", a.instrument_id).maybeSingle();
        if (!inst) return envelope("Instrument missing", "not_found", 404);
        const schema = inst.schema as unknown as InstrumentSchema;
        const answers = parsed.data.answers as Answers;
        const issues = validateAnswers(schema, answers);
        if (issues.length) return envelope("Answers invalid", "answers_invalid", 422, { issues });
        const score = scoreProm(schema.scoring, answers);
        const { data, error } = await db.from("prom_response").insert({
          tenant_id: auth.ctx.tenantId,
          assignment_id: params.id,
          instrument_version: inst.version,
          answers: answers as unknown,
          score: score as unknown,
          source: parsed.data.source,
        } as never).select("*").single();
        if (error) return envelope("database_error", "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "prom_response.create", "prom_response", data.id);
        return jsonData({ data }, 201);
      },
    },
  },
});