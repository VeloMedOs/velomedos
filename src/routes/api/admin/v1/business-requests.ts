import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const STAGES = ["request","contacted","demo","prospect","lead","negotiation","subscribed","rejected","archived"] as const;
const SOURCES = ["website","call_center","partner","referral","event","other"] as const;

export const Route = createFileRoute("/api/admin/v1/business-requests")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "subscribers:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const stage = url.searchParams.get("stage");
        const source = url.searchParams.get("source");
        const q = url.searchParams.get("q");
        const db = adminDb();
        let query = db.from("business_requests").select("*").order("created_at", { ascending: false });
        if (stage)  query = query.eq("stage", stage);
        if (source) query = query.eq("source", source);
        if (q)      query = query.or(`company_name.ilike.%${q}%,legal_name.ilike.%${q}%,nick_name.ilike.%${q}%,vat_number.ilike.%${q}%,cr_number.ilike.%${q}%,contact_email.ilike.%${q}%`);
        const { data, error } = await query.limit(500);
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ requests: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const required = ["company_name","contact_name","contact_email"];
        for (const k of required) if (!body[k]) return json({ error: `missing:${k}`, code: "validation", request_id: crypto.randomUUID() }, 400);
        const source = (body.source as string) ?? "call_center";
        if (!SOURCES.includes(source as typeof SOURCES[number])) return json({ error: "invalid_source", code: "validation", request_id: crypto.randomUUID() }, 400);
        const stage = (body.stage as string) ?? "request";
        if (!STAGES.includes(stage as typeof STAGES[number])) return json({ error: "invalid_stage", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const insert = {
          company_name: body.company_name, legal_name: body.legal_name ?? null, nick_name: body.nick_name ?? null,
          vat_number: body.vat_number ?? null, cr_number: body.cr_number ?? null,
          website_url: body.website_url ?? null, address_line: body.address_line ?? null,
          city: body.city ?? null, region: body.region ?? null, postal_code: body.postal_code ?? null, country: body.country ?? null,
          contact_name: body.contact_name, contact_email: body.contact_email, contact_phone: body.contact_phone ?? null,
          fleet_size: body.fleet_size ?? null, use_case: body.use_case ?? null, notes: body.notes ?? null,
          source, source_detail: body.source_detail ?? null, stage, status: stage === "subscribed" ? "approved" : "new",
          assigned_to: body.assigned_to ?? null,
          expected_seats: body.expected_seats ?? null, estimated_value_cents: body.estimated_value_cents ?? null, currency: body.currency ?? "USD",
          created_by: auth.via === "session" ? auth.userId : null,
        };
        const { data, error } = await db.from("business_requests").insert(insert).select().single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "business_request.create", "business_requests", data.id, { source, stage });
        return json(data, 201);
      },
    },
  },
});