import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, json, preflight, requireAdmin, serviceClient } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/promotions")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:read"); if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient().from("portal_promotions").select("*").order("created_at", { ascending: false });
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ promotions: data });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:write"); if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await serviceClient().from("portal_promotions").insert(body as never).select().single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "promotion.create", "portal_promotions", data.id, body);
        return json(data, 201);
      },
    },
  },
});