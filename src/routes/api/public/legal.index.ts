import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { json, preflight } from "@/lib/api-server";

/** GET /api/public/legal — list published legal documents (all locales). */
export const Route = createFileRoute("/api/public/legal/")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async () => {
      const db = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data, error } = await db
        .from("legal_documents")
        .select("slug, locale, title, summary, version, effective_date, published_at")
        .eq("status", "published")
        .order("slug", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      const SLUG_TO_PATH: Record<string, string> = {
        "privacy-home":     "/Privacy/Home",
        "terms-of-service": "/Privacy/TermsOfService",
        "hipaa":            "/Privacy/HIPAA",
        "patient-rights":   "/Privacy/PatientRights",
      };
      const rows = (data ?? []).map((r) => ({ ...r, url: SLUG_TO_PATH[r.slug] }));
      return json({ rows });
    },
  } },
});