import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/config/overrides")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "config:read"); if (!auth.ok) return auth.res;
        const sid = new URL(request.url).searchParams.get("subscriber_id");
        let q = adminDb().from("portal_config_overrides").select("*").order("updated_at", { ascending: false });
        if (sid) q = q.eq("subscriber_id", sid);
        const { data, error } = await q;
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ overrides: data });
      },
      PUT: async ({ request }) => {
        const auth = await requireAdmin(request, "config:write"); if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { subscriber_id?: string; key?: string; value?: unknown } | null;
        if (!body?.subscriber_id || !body.key) return json({ error: "missing_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("portal_config_overrides").upsert({
          subscriber_id: body.subscriber_id, key: body.key, value: body.value as never, updated_by: auth.userId, updated_at: new Date().toISOString(),
        }, { onConflict: "subscriber_id,key" }).select().single();
        if (error) return json({ error: error.message, code: "db/upsert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "config.override.upsert", "portal_config_overrides", data.id, body);
        return json(data);
      },
      DELETE: async ({ request }) => {
        const auth = await requireAdmin(request, "config:write"); if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const sid = url.searchParams.get("subscriber_id"); const key = url.searchParams.get("key");
        if (!sid || !key) return json({ error: "missing_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { error } = await adminDb().from("portal_config_overrides").delete().eq("subscriber_id", sid).eq("key", key);
        if (error) return json({ error: error.message, code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "config.override.delete", "portal_config_overrides", null, { sid, key });
        return json({ ok: true });
      },
    },
  },
});