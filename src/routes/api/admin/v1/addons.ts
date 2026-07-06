import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const FIELDS = ["code","name","description","unit_label","unit_type","price_cents","price_display","icon","is_active","sort_order"] as const;

export const Route = createFileRoute("/api/admin/v1/addons")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("subscription_addons").select("*").order("sort_order");
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ addons: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body?.code || !body?.name || !body?.unit_label)
          return json({ error: "missing:code|name|unit_label", code: "validation", request_id: crypto.randomUUID() }, 400);
        const insert: Record<string, unknown> = {};
        for (const k of FIELDS) if (k in body) insert[k] = body[k as string];
        insert.code = body.code; insert.name = body.name; insert.unit_label = body.unit_label;
        const { data, error } = await adminDb().from("subscription_addons").insert(insert).select().single();
        if (error) return json({ error: "database_error", code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "addon.create", "subscription_addons", data.id, { code: body.code });
        return json(data, 201);
      },
    },
  },
});