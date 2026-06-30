import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/**
 * Superadmin publish actions for the CMS overlay.
 *
 *   POST /api/admin/v1/site-content/publish
 *     body: { key, locale }            → promotes draft_value → published_value
 *     body: { keys: [{key,locale},…] } → bulk
 *     body: { all: true }              → publishes every staged draft
 *
 *   POST /api/admin/v1/site-content/unpublish
 *     body: { key, locale }            → clears published_value (keeps draft)
 *
 *   POST /api/admin/v1/site-content/bump-version
 *     forces a cache-bust on the marketing site without changing content.
 */
type PublishBody = {
  key?: string; locale?: string;
  keys?: Array<{ key: string; locale: string }>;
  all?: boolean;
};

export const Route = createFileRoute("/api/admin/v1/site-content/publish")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "cms:write");
        if (!auth.ok) return auth.res;
        const body = ((await request.json().catch(() => null)) as PublishBody | null) ?? {};
        const db = adminDb();
        const actor = auth.via === "session" ? auth.userId : null;

        let targets: Array<{ key: string; locale: string }> = [];
        if (body.all) {
          const { data } = await db
            .from("site_content")
            .select("key, locale, draft_value")
            .not("draft_value", "is", null);
          targets = (data ?? []).map((r: { key: string; locale: string }) => ({ key: r.key, locale: r.locale }));
        } else if (Array.isArray(body.keys) && body.keys.length) {
          targets = body.keys;
        } else if (body.key && body.locale) {
          targets = [{ key: body.key, locale: body.locale }];
        } else {
          return json({ error: "key+locale, keys[] or all=true required", code: "validation", request_id: crypto.randomUUID() }, 400);
        }

        const now = new Date().toISOString();
        const results: Array<{ key: string; locale: string; ok: boolean; error?: string }> = [];
        for (const t of targets) {
          const { data: row } = await db
            .from("site_content")
            .select("draft_value, published_value")
            .eq("key", t.key)
            .eq("locale", t.locale)
            .maybeSingle();
          const next = row?.draft_value ?? row?.published_value ?? null;
          if (next === null) { results.push({ ...t, ok: false, error: "nothing_to_publish" }); continue; }
          const { error } = await db.from("site_content").update({
            published_value: next,
            value: next,
            status: "published",
            draft_value: null,
            published_at: now,
            published_by: actor,
            updated_by: actor,
          }).eq("key", t.key).eq("locale", t.locale);
          if (error) { results.push({ ...t, ok: false, error: error.message }); continue; }
          results.push({ ...t, ok: true });
        }

        // Trigger auto-bumps version per row change, but force one extra bump
        // so a no-content-change publish (e.g. "republish all") still busts caches.
        await db.rpc("bump_site_content_version", { _actor: actor });
        const { data: ver } = await db.from("site_content_version").select("version").eq("id", 1).maybeSingle();
        const versionAfter = (ver as { version?: number } | null)?.version ?? null;

        // Per-row audit so each publish is traceable to staff + version.
        for (const r of results) {
          await adminAudit(
            auth.userId,
            r.ok ? "site_content.publish" : "site_content.publish_failed",
            "site_content",
            `${r.key}:${r.locale}`,
            {
              staff_user_id: auth.userId,
              via: auth.via,
              source: body.all ? "publish_all" : body.keys ? "publish_batch" : "publish_one",
              version_after: versionAfter,
              error: r.error ?? null,
            },
          );
        }
        // Roll-up entry so the batch is easy to find in the audit feed.
        await adminAudit(auth.userId, body.all ? "site_content.publish_all" : "site_content.publish_batch", "site_content", null, {
          staff_user_id: auth.userId,
          via: auth.via,
          count: results.length,
          succeeded: results.filter((r) => r.ok).length,
          version_after: versionAfter,
          results,
        });
        return json({ ok: true, results, version: versionAfter });
      },
    },
  },
});
