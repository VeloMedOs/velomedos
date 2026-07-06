import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const FIELDS = new Set(["code","name","description","unit_label","unit_type","price_cents","price_display","icon","is_active","sort_order"]);

export const Route = createFileRoute("/api/admin/v1/addons/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      PATCH: async ({ request, params }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const update: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body)) if (FIELDS.has(k)) update[k] = v;
        if (Object.keys(update).length === 0) return json({ error: "no_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("subscription_addons").update(update).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "addon.update", "subscription_addons", params.id, update);
        return json(data);
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const { error } = await adminDb().from("subscription_addons").delete().eq("id", params.id);
        if (error) return json({ error: "database_error", code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "addon.delete", "subscription_addons", params.id, null);
        return json({ ok: true });
      },
    },
  },
});