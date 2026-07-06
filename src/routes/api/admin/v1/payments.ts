import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/payments")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const db = adminDb();
        let q = db.from("portal_payments").select("*").order("created_at", { ascending: false }).limit(200);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ payments: data });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const row = { ...body, status: (body.status as string) ?? "pending" };
        const db = adminDb();
        const { data, error } = await db.from("portal_payments").insert(row as never).select().single();
        if (error) return json({ error: "database_error", code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "payment.record", "portal_payments", data.id, body);
        return json(data, 201);
      },
    },
  },
});