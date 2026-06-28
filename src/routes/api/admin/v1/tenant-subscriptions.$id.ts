import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const FIELDS = new Set(["plan_id","status","seats","current_period_start","current_period_end","cancel_at_period_end","notes"]);

export const Route = createFileRoute("/api/admin/v1/tenant-subscriptions/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireAdmin(request, "billing:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("tenant_subscriptions").select("*").eq("id", params.id).maybeSingle();
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        if (!data) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        return json(data);
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const update: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body)) if (FIELDS.has(k)) update[k] = v;
        if (Object.keys(update).length === 0) return json({ error: "no_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("tenant_subscriptions").update(update).eq("id", params.id).select().single();
        if (error) return json({ error: error.message, code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "tenant_subscription.update", "tenant_subscriptions", params.id, update);
        return json(data);
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const { error } = await adminDb().from("tenant_subscriptions").delete().eq("id", params.id);
        if (error) return json({ error: error.message, code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "tenant_subscription.delete", "tenant_subscriptions", params.id, null);
        return json({ ok: true });
      },
    },
  },
});