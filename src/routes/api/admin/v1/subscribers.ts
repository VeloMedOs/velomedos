import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/subscribers")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "subscribers:read");
        if (!auth.ok) return auth.res;
        const db = adminDb();
        const { data, error } = await db.from("corporate_accounts")
          .select("id, slug, company_name, country, status, plan_tier, logo_url, created_at, owner_user_id")
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ subscribers: data });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { slug?: string; company_name?: string; country?: string | null; plan_tier?: string } | null;
        if (!body?.slug || !body.company_name) return json({ error: "missing_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const { data, error } = await db.from("corporate_accounts").insert({
          slug: body.slug, company_name: body.company_name, country: body.country ?? null,
          plan_tier: body.plan_tier ?? "starter", status: "trialing",
        }).select().single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "subscriber.create", "corporate_accounts", data.id, { slug: body.slug });
        return json(data, 201);
      },
    },
  },
});