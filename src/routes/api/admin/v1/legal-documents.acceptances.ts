import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/** GET /api/admin/v1/legal-documents/acceptances?slug=&locale=&format=csv — PDPL consent register. */
export const Route = createFileRoute("/api/admin/v1/legal-documents/acceptances")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireAdmin(request, "config:read");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const slug = url.searchParams.get("slug");
      const locale = url.searchParams.get("locale");
      const format = url.searchParams.get("format");
      let q = adminDb().from("legal_acceptances")
        .select("slug, locale, version, subject_id, subject_email, ip_hash, user_agent, accepted_at")
        .order("accepted_at", { ascending: false }).limit(2000);
      if (slug) q = q.eq("slug", slug as never);
      if (locale) q = q.eq("locale", locale as never);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const rows = data ?? [];
      if (format === "csv") {
        const head = "slug,locale,version,subject_id,subject_email,ip_hash,user_agent,accepted_at";
        const body = rows.map((r: any) => [r.slug, r.locale, r.version, r.subject_id ?? "", r.subject_email ?? "", r.ip_hash ?? "",
          JSON.stringify(r.user_agent ?? ""), r.accepted_at].join(",")).join("\n");
        return new Response(head + "\n" + body, { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=legal-acceptances.csv" } });
      }
      return json({ rows });
    },
  } },
});