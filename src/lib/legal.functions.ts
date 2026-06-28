import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";

type LegalSlug   = Database["public"]["Enums"]["legal_slug"];
type LegalLocale = Database["public"]["Enums"]["legal_locale"];

const KNOWN_SLUGS: LegalSlug[]   = ["privacy-home","terms-of-service","hipaa","patient-rights"];
const KNOWN_LOCALES: LegalLocale[] = ["en","ar"];

export type LegalDoc = {
  slug: LegalSlug;
  locale: LegalLocale;
  title: string;
  summary: string | null;
  body_md: string;
  version: number;
  effective_date: string | null;
  published_at: string | null;
  updated_at: string;
};

export const getLegalDoc = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = data as { slug?: string; locale?: string } | undefined;
    const slug = d?.slug as LegalSlug | undefined;
    if (!slug || !KNOWN_SLUGS.includes(slug)) throw new Error("invalid_slug");
    const locale = (d?.locale ?? "en") as LegalLocale;
    if (!KNOWN_LOCALES.includes(locale)) throw new Error("invalid_locale");
    return { slug, locale };
  })
  .handler(async ({ data }): Promise<LegalDoc | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const cols = "slug, locale, title, summary, body_md, version, effective_date, published_at, updated_at";
    const fetchOne = async (locale: LegalLocale) => {
      const { data: row, error } = await db
        .from("legal_documents")
        .select(cols)
        .eq("slug", data.slug)
        .eq("locale", locale)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return row as LegalDoc | null;
    };
    const primary = await fetchOne(data.locale);
    if (primary) return primary;
    // locale fallback to EN
    return data.locale === "en" ? null : await fetchOne("en");
  });