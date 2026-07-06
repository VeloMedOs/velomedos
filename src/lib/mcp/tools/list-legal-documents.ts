import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicSupabase() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "list_legal_documents",
  title: "List published legal documents",
  description:
    "List VeloMed OS published legal documents (privacy, terms, HIPAA, patient rights) with slug, locale, version and effective date.",
  inputSchema: {
    locale: z.string().optional().describe("Optional locale filter (e.g. 'en', 'ar')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ locale }) => {
    const db = publicSupabase();
    let q = db
      .from("legal_documents")
      .select("slug, locale, title, summary, version, effective_date, published_at")
      .eq("status", "published")
      .order("slug", { ascending: true });
    if (locale) q = q.eq("locale", locale);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify({ count: rows.length, rows }, null, 2) }],
      structuredContent: { count: rows.length, rows },
    };
  },
});