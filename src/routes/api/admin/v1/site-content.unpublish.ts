import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/site-content/unpublish")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "cms:write");
        if (!auth.ok) return auth.res;
        const body = (await request.json().catch(() => null)) as { key?: string; locale?: string } | null;
        if (!body?.key || !body?.locale) return json({ error: "key and locale required", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const actor = auth.via === "session" ? auth.userId : null;
        const { data: row } = await db.from("site_content").select("published_value, draft_value").eq("key", body.key).eq("locale", body.locale).maybeSingle();
        const newDraft = row?.draft_value ?? row?.published_value ?? null;
        const { error } = await db.from("site_content").update({
          published_value: null,
          status: "draft",
          draft_value: newDraft,
          value: newDraft,
          published_at: null,
          published_by: null,
          updated_by: actor,
        }).eq("key", body.key).eq("locale", body.locale);
        if (error) return json({ error: error.message, code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "site_content.unpublish", "site_content", `${body.key}:${body.locale}`, null);
        return json({ ok: true });
      },
    },
  },
});
