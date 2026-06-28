import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/tickets")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "tickets:read"); if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const type = url.searchParams.get("type");
        const status = url.searchParams.get("status");
        let q = adminDb().from("portal_tickets").select("*").order("created_at", { ascending: false }).limit(200);
        if (type) q = q.eq("type", type);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ tickets: data });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "tickets:write"); if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body?.subject || !body?.type) return json({ error: "missing_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("portal_tickets").insert({ ...body, created_by: auth.userId } as never).select().single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "ticket.create", "portal_tickets", data.id, body);
        return json(data, 201);
      },
    },
  },
});