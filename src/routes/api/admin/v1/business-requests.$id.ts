import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const ALLOWED_PATCH_FIELDS = new Set([
  "company_name","legal_name","nick_name","vat_number","cr_number","website_url",
  "address_line","city","region","postal_code","country",
  "contact_name","contact_email","contact_phone",
  "fleet_size","use_case","notes","source","source_detail","stage","status",
  "assigned_to","expected_seats","estimated_value_cents","currency",
]);

export const Route = createFileRoute("/api/admin/v1/business-requests/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireAdmin(request, "subscribers:read");
        if (!auth.ok) return auth.res;
        const db = adminDb();
        const [{ data: req, error: e1 }, { data: events }] = await Promise.all([
          db.from("business_requests").select("*").eq("id", params.id).maybeSingle(),
          db.from("business_request_events").select("*").eq("request_id", params.id).order("created_at", { ascending: false }),
        ]);
        if (e1) return json({ error: e1.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        if (!req) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        return json({ request: req, events: events ?? [] });
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const update: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body)) if (ALLOWED_PATCH_FIELDS.has(k)) update[k] = v;
        if (Object.keys(update).length === 0) return json({ error: "no_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const { data, error } = await db.from("business_requests").update(update).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "business_request.update", "business_requests", params.id, update);
        return json(data);
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const db = adminDb();
        const { error } = await db.from("business_requests").delete().eq("id", params.id);
        if (error) return json({ error: "database_error", code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "business_request.delete", "business_requests", params.id, null);
        return json({ ok: true });
      },
    },
  },
});