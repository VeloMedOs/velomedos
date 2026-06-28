import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/tenant-subscriptions")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const tenant = url.searchParams.get("tenant_id");
        let q = adminDb().from("tenant_subscriptions").select("*").order("created_at", { ascending: false });
        if (tenant) q = q.eq("tenant_id", tenant);
        const { data, error } = await q;
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ subscriptions: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body?.tenant_id || !body?.plan_id) return json({ error: "missing:tenant_id|plan_id", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const { data: plan } = await db.from("subscription_plans").select("billing_period, included_seats").eq("id", body.plan_id).maybeSingle();
        const periodEnd = plan?.billing_period === "yearly" ? new Date(Date.now() + 365 * 864e5)
                        : plan?.billing_period === "monthly" ? new Date(Date.now() + 30 * 864e5) : null;
        // cancel existing actives for that tenant
        await db.from("tenant_subscriptions").update({ status: "cancelled", cancel_at_period_end: false })
          .eq("tenant_id", body.tenant_id).in("status", ["trialing","active","past_due"]);
        const insert = {
          tenant_id: body.tenant_id, plan_id: body.plan_id, status: (body.status as string) ?? "active",
          seats: (body.seats as number) ?? plan?.included_seats ?? 1,
          current_period_start: (body.current_period_start as string) ?? new Date().toISOString(),
          current_period_end: (body.current_period_end as string) ?? periodEnd?.toISOString() ?? null,
          cancel_at_period_end: !!body.cancel_at_period_end, notes: body.notes ?? null,
          assigned_by: auth.via === "session" ? auth.userId : null,
        };
        const { data, error } = await db.from("tenant_subscriptions").insert(insert).select().single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "tenant_subscription.create", "tenant_subscriptions", data.id, { tenant_id: body.tenant_id, plan_id: body.plan_id });
        return json(data, 201);
      },
    },
  },
});