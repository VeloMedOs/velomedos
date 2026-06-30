import { createFileRoute } from "@tanstack/react-router";
import { preflight, serviceClient } from "@/lib/api-server";

/**
 * Public marketing-site content overlay.
 *
 *  - Default: returns PUBLISHED values only (published_value).
 *  - `?preview=1` + Authorization bearer of a portal-staff session: returns
 *    draft_value ?? published_value so editors can preview staged drafts
 *    before publishing. Drafts NEVER leak to anonymous visitors.
 *
 * Cache-busting: every response carries `ETag: "v<version>"` derived from
 * `site_content_version`. The version auto-bumps whenever any published row
 * changes, so the marketing site sees fresh content on the next request and
 * any `If-None-Match` revalidation returns 304 until the next publish.
 *
 * A lightweight row is appended to `debug_events` per request so stale-content
 * reports can be traced (version served, preview flag, referer).
 *
 * Shape: { content: { [key]: { [locale]: value } }, version, preview, generated_at }
 */
export const Route = createFileRoute("/api/public/v1/site-content")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        const wantPreview = url.searchParams.get("preview") === "1";
        const db = serviceClient();

        let isStaff = false;
        let staffUserId: string | null = null;
        if (wantPreview) {
          const authHeader = request.headers.get("authorization") ?? "";
          const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
          if (bearer) {
            const { data: u } = await db.auth.getUser(bearer);
            if (u?.user) {
              const { data: staff } = await db.rpc("is_portal_staff", { _user_id: u.user.id });
              if (staff) { isStaff = true; staffUserId = u.user.id; }
            }
          }
        }
        const allowDraft = wantPreview && isStaff;

        const { data: verRow } = await db
          .from("site_content_version")
          .select("version")
          .eq("id", 1)
          .maybeSingle();
        const version = ((verRow as { version?: number } | null)?.version) ?? 1;
        // Tag preview separately so cached public responses never leak drafts.
        const etag = `"v${version}${allowDraft ? "-preview" : ""}"`;

        const ifNoneMatch = request.headers.get("if-none-match");
        if (ifNoneMatch && ifNoneMatch === etag) {
          return new Response(null, { status: 304, headers: baseHeaders(etag, version, allowDraft) });
        }

        let q = db.from("site_content").select("key, locale, draft_value, published_value");
        if (key) q = q.eq("key", key);
        const { data, error } = await q;

        const content: Record<string, Record<string, unknown>> = {};
        if (!error) {
          for (const row of (data ?? []) as Array<{
            key: string; locale: string; draft_value: unknown; published_value: unknown;
          }>) {
            const v = allowDraft ? (row.draft_value ?? row.published_value) : row.published_value;
            if (v === null || v === undefined) continue;
            (content[row.key] ||= {})[row.locale] = v;
          }
        }

        // Fire-and-forget request log for stale-content diagnosis.
        db.from("debug_events").insert({
          source: "api.site_content",
          level: "info",
          message: allowDraft ? "preview_fetch" : "public_fetch",
          payload: {
            version,
            key,
            preview: allowDraft,
            staff_user_id: staffUserId,
            ua: request.headers.get("user-agent")?.slice(0, 180) ?? null,
            referer: request.headers.get("referer")?.slice(0, 240) ?? null,
            rows: (data ?? []).length,
            keys: Object.keys(content).length,
          } as never,
        }).then(() => {});

        const body = { content, version, preview: allowDraft, generated_at: new Date().toISOString() };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json", ...baseHeaders(etag, version, allowDraft) },
        });
      },
    },
  },
});

function baseHeaders(etag: string, version: number, isPreview: boolean): Record<string, string> {
  return {
    etag,
    "cache-control": isPreview ? "no-store" : "public, max-age=0, must-revalidate",
    "x-velomed-cms-version": String(version),
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "etag, x-velomed-cms-version",
  };
}
