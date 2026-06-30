import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/**
 * Superadmin CMS — stage, publish, unpublish marketing-site overlay content.
 *
 * Data model:
 *   - draft_value     → staged, only visible in ?cms=preview
 *   - published_value → live on the marketing site
 *
 * Endpoints:
 *   GET    /api/admin/v1/site-content[?key=&locale=&status=]
 *   PUT    /api/admin/v1/site-content   { key, locale, value, status: 'draft'|'published' }
 *          status='draft'     → writes only draft_value (published untouched)
 *          status='published' → writes published_value and clears draft_value
 *   DELETE /api/admin/v1/site-content?key=&locale=
 *
 * The site-content version (used by the marketing site for cache-bust) is
 * bumped automatically by a DB trigger whenever published_value changes.
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
        if (status === "draft") q = q.not("draft_value", "is", null);
        if (status === "published") q = q.not("published_value", "is", null);
        const { data, error } = await q.order("key").order("locale");
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 400);
        const { data: ver } = await db.from("site_content_version").select("version, bumped_at").eq("id", 1).maybeSingle();
        return json({ rows: data ?? [], version: ver ?? null });
      },
      PUT: async ({ request }) => {
        const auth = await requireAdmin(request, "cms:write");
        if (!auth.ok) return auth.res;
        const body = (await request.json().catch(() => null)) as
          | { key?: string; locale?: string; value?: unknown; status?: "draft" | "published" }
          | null;
        if (!body?.key || !body?.locale || body.value === undefined)
          return json({ error: "key, locale and value required", code: "validation", request_id: crypto.randomUUID() }, 400);

        const db = adminDb();
        const actor = auth.via === "session" ? auth.userId : null;
        // Load current row so we can preserve the "other side" of the draft/published pair.
        const { data: existing } = await db
          .from("site_content")
          .select("draft_value, published_value")
          .eq("key", body.key)
          .eq("locale", body.locale)
          .maybeSingle();

        const isPublish = body.status === "published";
        const patch = {
          key: body.key,
          locale: body.locale,
          // Legacy `value` kept in sync with the live representation so any
          // older readers stay correct.
          value: isPublish ? body.value : (existing?.published_value ?? body.value),
          status: isPublish ? "published" : "draft",
          draft_value: isPublish ? null : body.value,
          published_value: isPublish ? body.value : (existing?.published_value ?? null),
          published_at: isPublish ? new Date().toISOString() : (existing?.published_value ? undefined : null),
          published_by: isPublish ? actor : undefined,
          updated_by: actor,
        };

        const { data, error } = await db
          .from("site_content")
          .upsert(patch, { onConflict: "key,locale" })
          .select()
          .single();
        if (error) return json({ error: error.message, code: "db/upsert_failed", request_id: crypto.randomUUID() }, 400);

        await adminAudit(
          auth.userId,
          isPublish ? "site_content.publish" : "site_content.save_draft",
          "site_content",
          `${body.key}:${body.locale}`,
          { status: patch.status },
        );
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
