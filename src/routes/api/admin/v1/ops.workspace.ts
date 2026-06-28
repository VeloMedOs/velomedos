import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/ops/workspace")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "config:read"); if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("ops_workspace_settings").select("*").order("key");
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ rows: data ?? [] });
      },
      PUT: async ({ request }) => {
        const auth = await requireAdmin(request, "config:write"); if (!auth.ok) return auth.res;
        const body = (await request.json().catch(() => null)) as { key?: string; value?: unknown; description?: string } | null;
        if (!body?.key) return json({ error: "missing_key", code: "validation", request_id: crypto.randomUUID() }, 400);
        const row = { key: body.key, value: body.value ?? null, description: body.description ?? null, updated_by: auth.userId };
        const { data, error } = await adminDb().from("ops_workspace_settings").upsert(row as never, { onConflict: "key" }).select().single();
        if (error) return json({ error: error.message, code: "db/upsert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "ops_workspace_settings.upsert", "ops_workspace_settings", body.key, row);
        return json(data);
      },
      DELETE: async ({ request }) => {
        const auth = await requireAdmin(request, "config:write"); if (!auth.ok) return auth.res;
        const key = new URL(request.url).searchParams.get("key");
        if (!key) return json({ error: "missing_key", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { error } = await adminDb().from("ops_workspace_settings").delete().eq("key", key);
        if (error) return json({ error: error.message, code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "ops_workspace_settings.delete", "ops_workspace_settings", key, null);
        return json({ ok: true });
      },
    },
  },
});