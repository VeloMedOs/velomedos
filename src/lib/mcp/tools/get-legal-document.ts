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
  name: "get_legal_document",
  title: "Get a legal document",
  description:
    "Fetch a published legal document by slug (and optional locale). Returns the rendered body (markdown/HTML) plus metadata.",
  inputSchema: {
    slug: z
      .string()
      .min(1)
      .describe("Legal doc slug, e.g. 'privacy-home', 'terms-of-service', 'hipaa', 'patient-rights'."),
    locale: z.string().optional().describe("Optional locale (defaults to first published)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ slug, locale }) => {
    const db = publicSupabase();
    let q = db
      .from("legal_documents")
      .select("slug, locale, title, summary, body_md, body_html, version, effective_date, published_at")
      .eq("status", "published")
      .eq("slug", slug as never)
      .limit(1);
    if (locale) q = q.eq("locale", locale as never);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    const row = (data ?? [])[0];
    if (!row) {
      return { content: [{ type: "text", text: `Not found: ${slug}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: row.body_md ?? row.body_html ?? row.summary ?? "" }],
      structuredContent: { row },
    };
  },
});