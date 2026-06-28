import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/plans")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("subscription_plans").select("*").order("sort_order");
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ plans: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body?.code || !body?.name || body.price_cents === undefined)
          return json({ error: "missing:code|name|price_cents", code: "validation", request_id: crypto.randomUUID() }, 400);
        const insert = {
          code: body.code, name: body.name, description: body.description ?? null,
          price_cents: body.price_cents, currency: body.currency ?? "USD",
          billing_period: body.billing_period ?? "monthly", included_seats: body.included_seats ?? 1,
          features: body.features ?? [], is_active: body.is_active ?? true, sort_order: body.sort_order ?? 0,
          eyebrow: body.eyebrow ?? null, tagline: body.tagline ?? null,
          units_label: body.units_label ?? null, seats_label: body.seats_label ?? null, api_label: body.api_label ?? null,
          is_public: body.is_public ?? false, highlight: body.highlight ?? false,
          cta_label: body.cta_label ?? null, cta_to: body.cta_to ?? null,
        };
        const { data, error } = await adminDb().from("subscription_plans").insert(insert).select().single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "plan.create", "subscription_plans", data.id, { code: body.code });
        return json(data, 201);
      },
    },
  },
});