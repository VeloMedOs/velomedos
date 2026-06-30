import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/** Force the marketing site to refetch by bumping the cache-bust version. */
export const Route = createFileRoute("/api/admin/v1/site-content/bump-version")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "cms:write");
        if (!auth.ok) return auth.res;
        const db = adminDb();
        const actor = auth.via === "session" ? auth.userId : null;
        const { data, error } = await db.rpc("bump_site_content_version", { _actor: actor });
        if (error) return json({ error: error.message, code: "rpc/failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "site_content.bump_version", "site_content_version", "1", {
          staff_user_id: auth.userId,
          via: auth.via,
          version_after: data,
          reason: "manual_cache_bust",
        });
        return json({ ok: true, version: data });
      },
    },
  },
});
