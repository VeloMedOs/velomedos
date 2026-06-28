import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { json, preflight } from "@/lib/api-server";

type LegalSlug   = Database["public"]["Enums"]["legal_slug"];
type LegalLocale = Database["public"]["Enums"]["legal_locale"];
const SLUGS: LegalSlug[] = ["privacy-home","terms-of-service","hipaa","patient-rights"];

export const Route = createFileRoute("/api/public/legal/$slug")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const slug = (params as { slug: string }).slug as LegalSlug;
      if (!SLUGS.includes(slug)) return json({ error: "not_found" }, 404);
      const url = new URL(request.url);
      const requested = (url.searchParams.get("locale") ?? "en") as LegalLocale;
      const db = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const cols = "slug, locale, title, summary, body_md, body_html, version, effective_date, published_at, updated_at";
      const read = (locale: LegalLocale) => db
        .from("legal_documents").select(cols)
        .eq("slug", slug).eq("locale", locale).eq("status", "published").maybeSingle();
      let { data, error } = await read(requested);
      if (error) return json({ error: error.message }, 500);
      if (!data && requested !== "en") {
        const fb = await read("en"); data = fb.data; if (fb.error) return json({ error: fb.error.message }, 500);
      }
      if (!data) return json({ error: "not_found" }, 404);
      const etag = `"${data.slug}:${data.locale}:${data.version}"`;
      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: { etag, "cache-control": "public, max-age=300" } });
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=300",
          etag,
          "access-control-allow-origin": "*",
        },
      });
    },
  } },
});