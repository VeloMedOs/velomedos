import { createServerFn } from "@tanstack/react-start";

export type LegalDoc = {
  slug: string;
  title: string;
  subtitle: string | null;
  body_md: string;
  version: number;
  effective_date: string | null;
  updated_at: string;
};

export const getLegalDoc = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const slug = (data as { slug?: string })?.slug;
    if (!slug || typeof slug !== "string") throw new Error("missing_slug");
    return { slug };
  })
  .handler(async ({ data }): Promise<LegalDoc | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: row, error } = await db
      .from("legal_documents")
      .select("slug, title, subtitle, body_md, version, effective_date, updated_at")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as LegalDoc | null) ?? null;
  });