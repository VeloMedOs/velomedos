import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/platform-settings/demo-videos")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "platform:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { enabled?: boolean } | null;
        if (typeof body?.enabled !== "boolean") return json({ error: "invalid_input", code: "validation", request_id: crypto.randomUUID() }, 400);
        // Wrap in { enabled } jsonb envelope — do not store bare boolean.
        const { data, error } = await adminDb().from("platform_settings").upsert({
          key: "demo_videos_enabled",
          value: { enabled: body.enabled },
        }, { onConflict: "key" }).select().single();
        if (error) return json({ error: "database_error", code: "db/upsert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "demo_videos.toggle", "platform_settings", "demo_videos_enabled", { enabled: body.enabled });
        return json(data);
      },
    },
  },
});