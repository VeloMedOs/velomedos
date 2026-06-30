import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/**
 * Superadmin CMS — list/upsert/publish marketing-site overlay content.
 * GET    /api/admin/v1/site-content[?key=&locale=&status=]
 * PUT    /api/admin/v1/site-content  { key, locale, value, status? }
 * DELETE /api/admin/v1/site-content?key=&locale=
 */
export const Route = createFileRoute("/api/admin/v1/site-content")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "cms:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const db = adminDb();
        let q = db.from("site_content").select("*");
        const key = url.searchParams.get("key");
        const locale = url.searchParams.get("locale");
        const status = url.searchParams.get("status");
        if (key) q = q.eq("key", key);
        if (locale) q = q.eq("locale", locale);
        if (status) q = q.eq("status", status);
        const { data, error } = await q.order("key").order("locale");
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 400);
        return json({ rows: data ?? [] });
      },
      PUT: async ({ request }) => {
        const auth = await requireAdmin(request, "cms:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { key?: string; locale?: string; value?: unknown; status?: "draft" | "published" } | null;
        if (!body?.key || !body?.locale || body.value === undefined)
          return json({ error: "key, locale and value required", code: "validation", request_id: crypto.randomUUID() }, 400);
        const status = body.status === "published" ? "published" : "draft";
        const db = adminDb();
        const { data, error } = await db.from("site_content").upsert({
          key: body.key, locale: body.locale, value: body.value, status,
          updated_by: auth.via === "session" ? auth.userId : null,
        }, { onConflict: "key,locale" }).select().single();
        if (error) return json({ error: error.message, code: "db/upsert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "site_content.upsert", "site_content", `${body.key}:${body.locale}`, { status });
        return json(data);
      },
      DELETE: async ({ request }) => {
        const auth = await requireAdmin(request, "cms:write");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        const locale = url.searchParams.get("locale");
        if (!key || !locale) return json({ error: "key and locale required", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const { error } = await db.from("site_content").delete().eq("key", key).eq("locale", locale);
        if (error) return json({ error: error.message, code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "site_content.delete", "site_content", `${key}:${locale}`, null);
        return json({ ok: true });
      },
    },
  },
});