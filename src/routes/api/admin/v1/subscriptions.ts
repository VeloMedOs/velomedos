import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/subscriptions")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const subscriber = url.searchParams.get("subscriber_id");
        const db = adminDb();
        let q = db.from("portal_subscriptions").select("*").order("created_at", { ascending: false });
        if (subscriber) q = q.eq("subscriber_id", subscriber);
        const { data, error } = await q;
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ subscriptions: data });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const { data, error } = await db.from("portal_subscriptions").insert(body as never).select().single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "subscription.create", "portal_subscriptions", data.id, body);
        return json(data, 201);
      },
    },
  },
});