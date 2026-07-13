import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/platform-settings")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "platform:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("platform_settings").select("*");
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ settings: data ?? [] });
      },
      PATCH: async ({ request }) => {
        const auth = await requireAdmin(request, "platform:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { key?: string; value?: unknown } | null;
        if (!body?.key) return json({ error: "invalid_input", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("platform_settings").upsert({
          key: body.key, value: body.value ?? null,
        }, { onConflict: "key" }).select().single();
        if (error) return json({ error: "database_error", code: "db/upsert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "platform_setting.upsert", "platform_settings", body.key, body);
        return json(data);
      },
    },
  },
});