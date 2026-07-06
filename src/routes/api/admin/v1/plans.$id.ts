import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const FIELDS = new Set([
  "code","name","description","price_cents","currency","billing_period","included_seats","features","is_active","sort_order",
  "eyebrow","tagline","units_label","seats_label","api_label","is_public","highlight","cta_label","cta_to",
]);

export const Route = createFileRoute("/api/admin/v1/plans/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireAdmin(request, "billing:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("subscription_plans").select("*").eq("id", params.id).maybeSingle();
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
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
        const { data, error } = await adminDb().from("subscription_plans").update(update).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "plan.update", "subscription_plans", params.id, update);
        return json(data);
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const { error } = await adminDb().from("subscription_plans").delete().eq("id", params.id);
        if (error) return json({ error: "database_error", code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "plan.delete", "subscription_plans", params.id, null);
        return json({ ok: true });
      },
    },
  },
});