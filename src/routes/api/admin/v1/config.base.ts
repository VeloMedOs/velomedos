import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/config/base")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "config:read"); if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("portal_config_base").select("*").order("key");
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ base: data });
      },
      PUT: async ({ request }) => {
        const auth = await requireAdmin(request, "config:write"); if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { key?: string; value?: unknown; description?: string } | null;
        if (!body?.key) return json({ error: "missing_key", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("portal_config_base").upsert({ key: body.key, value: body.value as never, description: body.description ?? null, updated_by: auth.userId, updated_at: new Date().toISOString() }).select().single();
        if (error) return json({ error: "database_error", code: "db/upsert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "config.base.upsert", "portal_config_base", null, { key: body.key });
        return json(data);
      },
    },
  },
});