import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json, preflight, serviceClient } from "@/lib/api-server";

const baseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
});

const intakeSchema = z.discriminatedUnion("kind", [
  baseSchema.extend({
    kind: z.literal("emergency"),
    severity: z.enum(["code_red", "code_yellow", "routine"]),
    symptoms: z.string().trim().max(2000).optional().nullable(),
  }),
  baseSchema.extend({ kind: z.literal("clinic"), service: z.string().trim().max(200).optional().nullable() }),
  baseSchema.extend({ kind: z.literal("screening"), service: z.string().trim().max(200).optional().nullable() }),
  baseSchema.extend({ kind: z.literal("rental"), service: z.string().trim().max(200).optional().nullable() }),
  baseSchema.extend({ kind: z.literal("training"), service: z.string().trim().max(200).optional().nullable() }),
  baseSchema.extend({ kind: z.literal("general") }),
]);

// crude per-IP rate limit (process-local, demo-grade)
const rate = new Map<string, { n: number; resetAt: number }>();
function limited(ip: string) {
  const now = Date.now();
  const b = rate.get(ip);
  if (!b || b.resetAt < now) { rate.set(ip, { n: 1, resetAt: now + 60_000 }); return false; }
  b.n += 1;
  return b.n > 10;
}

function makeCode(prefix: string) {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`;
  const rnd = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${ymd}-${rnd}`;
}

export const Route = createFileRoute("/api/public/v1/web_intake")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
        if (limited(ip)) return json({ error: "rate_limited" }, 429);
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
        const parsed = intakeSchema.safeParse(body);
        if (!parsed.success) return json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
        const data = parsed.data;
        const db = serviceClient();

        if (data.kind === "emergency") {
          const code = makeCode("WEB");
          const slaMinutes = data.severity === "code_red" ? 8 : data.severity === "code_yellow" ? 20 : 60;
          const { data: inc, error } = await db.from("incidents").insert({
            code,
            severity: data.severity,
            status: "pending",
            source: "web",
            caller_name: data.name,
            caller_phone: data.phone ?? null,
            patient_name: data.name,
            address: data.address ?? data.city ?? null,
            pickup_lat: data.lat ?? null,
            pickup_lng: data.lng ?? null,
            symptoms: data.symptoms ?? data.message ?? null,
            notes: data.message ?? null,
            sla_target_at: new Date(Date.now() + slaMinutes * 60_000).toISOString(),
          }).select("id, code").single();
          if (error || !inc) return json({ error: "create_failed", detail: error?.message }, 500);
          await db.from("incident_events").insert({
            incident_id: inc.id,
            event_type: "web_submission",
            payload: { source: "web", ip, city: data.city, email: data.email },
          });
          return json({ ok: true, kind: "emergency", reference_code: inc.code, id: inc.id, sla_minutes: slaMinutes });
        }

        const ref = makeCode(data.kind.slice(0, 3).toUpperCase());
        const { error } = await db.from("web_leads").insert({
          reference_code: ref,
          kind: data.kind,
          name: data.name,
          phone: data.phone ?? null,
          email: data.email ?? null,
          city: data.city ?? null,
          service: "service" in data ? data.service ?? null : null,
          message: data.message ?? null,
          payload: { lat: data.lat ?? null, lng: data.lng ?? null, address: data.address ?? null, ip },
        });
        if (error) return json({ error: "create_failed", detail: error.message }, 500);
        return json({ ok: true, kind: data.kind, reference_code: ref });
      },
    },
  },
});