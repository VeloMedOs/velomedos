import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/** GET /api/admin/v1/legal-documents/history?slug=&locale= — version history. */
export const Route = createFileRoute("/api/admin/v1/legal-documents/history")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireAdmin(request, "config:read");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const slug = url.searchParams.get("slug");
      const locale = url.searchParams.get("locale") ?? "en";
      if (!slug) return json({ error: "missing_slug" }, 400);
      const { data, error } = await adminDb().from("legal_document_versions")
        .select("version, title, summary, body_md, effective_date, status, change_note, actor_id, snapshot_at")
        .eq("slug", slug as never).eq("locale", locale as never)
        .order("version", { ascending: false });
      if (error) return json({ error: "database_error" }, 500);
      return json({ rows: data ?? [] });
    },
  } },
});