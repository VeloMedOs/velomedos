import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

function slugify(s: string) { return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "tenant"; }

export const Route = createFileRoute("/api/admin/v1/business-requests/$id/convert")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => ({})) as { slug?: string; plan_tier?: string; plan_id?: string; seats?: number };
        const db = adminDb();
        const { data: req, error: e0 } = await db.from("business_requests").select("*").eq("id", params.id).maybeSingle();
        if (e0 || !req) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        if (req.converted_tenant_id) return json({ error: "already_converted", code: "conflict", tenant_id: req.converted_tenant_id, request_id: crypto.randomUUID() }, 409);

        const slug = body.slug || slugify(req.nick_name || req.company_name);
        const { data: tenant, error: e1 } = await db.from("corporate_accounts").insert({
          slug, company_name: req.legal_name || req.company_name, billing_ref: req.vat_number ?? null,
          contact_email: req.contact_email, contact_phone: req.contact_phone,
          status: "trialing", plan_tier: body.plan_tier ?? "starter", country: req.country,
        }).select().single();
        if (e1 || !tenant) return json({ error: e1?.message ?? "tenant_create_failed", code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);

        let subscription: unknown = null;
        if (body.plan_id) {
          const { data: plan } = await db.from("subscription_plans").select("*").eq("id", body.plan_id).maybeSingle();
          const periodEnd = plan?.billing_period === "yearly" ? new Date(Date.now() + 365 * 864e5)
                          : plan?.billing_period === "monthly" ? new Date(Date.now() + 30 * 864e5) : null;
          const { data: sub } = await db.from("tenant_subscriptions").insert({
            tenant_id: tenant.id, plan_id: body.plan_id, status: "active",
            seats: body.seats ?? req.expected_seats ?? plan?.included_seats ?? 1,
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd?.toISOString() ?? null,
            assigned_by: auth.via === "session" ? auth.userId : null,
          }).select().single();
          subscription = sub;
        }

        await db.from("business_requests").update({
          stage: "subscribed", status: "approved",
          converted_tenant_id: tenant.id, reviewed_by: auth.via === "session" ? auth.userId : null, reviewed_at: new Date().toISOString(),
        }).eq("id", params.id);
        await db.from("business_request_events").insert({
          request_id: params.id, actor_id: auth.via === "session" ? auth.userId : null,
          kind: "converted", to_stage: "subscribed", payload: { tenant_id: tenant.id, plan_id: body.plan_id ?? null },
        });
        await adminAudit(auth.userId, "business_request.convert", "corporate_accounts", tenant.id, { request_id: params.id });
        return json({ tenant, subscription, request_id: params.id }, 201);
      },
    },
  },
});