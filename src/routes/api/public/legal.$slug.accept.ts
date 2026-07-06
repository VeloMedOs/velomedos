import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import type { Database } from "@/integrations/supabase/types";
import { json, preflight } from "@/lib/api-server";

type LegalSlug   = Database["public"]["Enums"]["legal_slug"];
type LegalLocale = Database["public"]["Enums"]["legal_locale"];
const SLUGS: LegalSlug[]   = ["privacy-home","terms-of-service","hipaa","patient-rights"];
const LOCALES: LegalLocale[] = ["en","ar"];

/** POST /api/public/legal/:slug/accept — record consent for the currently published version. */
export const Route = createFileRoute("/api/public/legal/$slug/accept")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const slug = (params as { slug: string }).slug as LegalSlug;
      if (!SLUGS.includes(slug)) return json({ error: "unknown_slug" }, 404);
      const body = await request.json().catch(() => ({} as Record<string, unknown>));
      const locale = ((body?.locale as string) ?? "en") as LegalLocale;
      if (!LOCALES.includes(locale)) return json({ error: "invalid_locale" }, 400);
      const subject_email = typeof body?.subject_email === "string" ? (body.subject_email as string).slice(0, 320) : null;

      const db = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      // Resolve current published version (locale fallback to en)
      let { data: doc } = await db.from("legal_documents")
        .select("version, locale").eq("slug", slug).eq("locale", locale).eq("status", "published").maybeSingle();
      if (!doc && locale !== "en") {
        const fb = await db.from("legal_documents")
          .select("version, locale").eq("slug", slug).eq("locale", "en").eq("status", "published").maybeSingle();
        doc = fb.data ?? null;
      }
      if (!doc) return json({ error: "not_published" }, 404);

      // Salted hash of IP — never store the raw IP.
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
      const salt = process.env.SUPABASE_PUBLISHABLE_KEY ?? "velomed-os-salt";
      const ip_hash = ip ? createHmac("sha256", salt).update(ip).digest("hex") : null;
      const user_agent = (request.headers.get("user-agent") ?? "").slice(0, 512);

      const { error } = await db.from("legal_acceptances").insert({
        slug, locale: doc.locale, version: doc.version,
        subject_email, ip_hash, user_agent,
      });
      if (error) return json({ error: "database_error" }, 400);
      return json({ accepted: true, version: doc.version, locale: doc.locale });
    },
  } },
});