import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json, preflight, serviceClient } from "@/lib/api-server";
import { sendBusinessIntakeAcknowledgment } from "@/lib/interface/sms-gateway";

const schema = z.object({
  company_name: z.string().trim().min(2).max(200),
  legal_name: z.string().trim().max(200).optional().nullable(),
  nick_name:  z.string().trim().max(120).optional().nullable(),
  vat_number: z.string().trim().max(60).optional().nullable(),
  cr_number:  z.string().trim().max(60).optional().nullable(),
  website_url: z.string().trim().url().max(500).optional().nullable(),
  contact_name:  z.string().trim().min(2).max(120),
  contact_email: z.string().trim().email().max(255),
  contact_phone: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  city:    z.string().trim().max(120).optional().nullable(),
  fleet_size:    z.number().int().min(0).max(100000).optional().nullable(),
  expected_seats: z.number().int().min(0).max(100000).optional().nullable(),
  use_case: z.string().trim().max(2000).optional().nullable(),
  notes:    z.string().trim().max(2000).optional().nullable(),
  source_detail: z.string().trim().max(200).optional().nullable(),
  display_consent: z.boolean().optional(),
  display_type: z.enum(["hospital","clinic_group","ems","payer_tpa"]).optional(),
});

const rate = new Map<string, { n: number; resetAt: number }>();

export const Route = createFileRoute("/api/public/v1/business_intake")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
        const now = Date.now();
        const b = rate.get(ip);
        if (!b || b.resetAt < now) rate.set(ip, { n: 1, resetAt: now + 60_000 });
        else { b.n += 1; if (b.n > 6) return json({ error: "rate_limited" }, 429); }

        const body = await request.json().catch(() => null);
        const parsed = schema.safeParse(body);
        if (!parsed.success) return json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
        const d = parsed.data;
        const db = serviceClient();
        const consent = d.display_consent === true;
        const { display_consent: _dc, display_type, ...rest } = d;
        const { data, error } = await db.from("business_requests").insert({
          ...rest,
          source: "website",
          stage: "request",
          status: "new",
          currency: "USD",
          display_type: display_type ?? null,
          display_consent: consent,
          display_consent_source: consent ? "partner_intake_form" : null,
          display_consent_at: consent ? new Date().toISOString() : null,
          // candidate for the public marquee; superadmin still must flip
          // `display_publicly` from the Featured Partners pane.
          display_publicly: false,
        }).select("id, company_name, stage, source, created_at").single();
        if (error) { console.error("business_intake", error); return json({ error: "create_failed" }, 500); }
        // Convention #27 — route ack through SMS-gateway stub (debt #42).
        try {
          await sendBusinessIntakeAcknowledgment({
            contact_phone: d.contact_phone ?? null,
            contact_email: d.contact_email,
            company_name: d.company_name,
            request_id: (data as { id: string }).id,
          }, db);
        } catch { /* best-effort */ }
        return json({ ok: true, request: data });
      },
    },
  },
});