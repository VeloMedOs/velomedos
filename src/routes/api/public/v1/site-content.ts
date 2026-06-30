import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";

/**
 * Public marketing-site content overlay.
 *  - Default: returns PUBLISHED rows only.
 *  - `?preview=1` + Authorization bearer of a portal-staff session: also
 *    merges DRAFT rows so Superadmin editors can preview changes before
 *    publishing. Draft rows shadow published rows when both exist.
 * Shape: { content: { [key]: { [locale]: value } } }
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
        if (wantPreview) {
          const authHeader = request.headers.get("authorization") ?? "";
          const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
          if (bearer) {
            const { data: u } = await db.auth.getUser(bearer);
            if (u?.user) {
              const { data: staff } = await db.rpc("is_portal_staff", { _user_id: u.user.id });
              if (staff) isStaff = true;
            }
          }
        }

        const allowDraft = wantPreview && isStaff;
        let q = db.from("site_content").select("key, locale, value, status");
        if (!allowDraft) q = q.eq("status", "published");
        if (key) q = q.eq("key", key);
        const { data, error } = await q;
        if (error) return json({ content: {} });

        // When previewing, drafts shadow published rows for the same (key,locale).
        const content: Record<string, Record<string, unknown>> = {};
        const seenDraft = new Set<string>();
        for (const row of (data ?? []) as Array<{ key: string; locale: string; value: unknown; status: string }>) {
          const tag = `${row.key}::${row.locale}`;
          if (row.status === "draft") {
            (content[row.key] ||= {})[row.locale] = row.value;
            seenDraft.add(tag);
          } else if (!seenDraft.has(tag)) {
            (content[row.key] ||= {})[row.locale] = row.value;
          }
        }
        return json({
          content,
          preview: allowDraft,
          generated_at: new Date().toISOString(),
        });
      },
    },
  },
});