import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { json, preflight } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/legal/$slug")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ params }) => {
      const slug = (params as { slug: string }).slug;
      const db = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data, error } = await db
        .from("legal_documents")
        .select("slug, title, subtitle, body_md, version, effective_date, updated_at")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "not_found" }, 404);
      return json(data);
    },
  } },
});