import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { SERVICE_PAGES } from "@/content/services";

export default defineTool({
  name: "list_services",
  title: "List VeloMed OS services",
  description:
    "Return the catalog of VeloMed OS product/service pages (slug, title, subtitle, audiences, outcomes, related). Public marketing content.",
  inputSchema: {
    query: z
      .string()
      .optional()
      .describe("Optional keyword to filter services by title/subtitle/slug."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query }) => {
    const q = (query ?? "").trim().toLowerCase();
    const rows = SERVICE_PAGES
      .filter((s) =>
        !q ||
        s.slug.includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.subtitle.toLowerCase().includes(q),
      )
      .map((s) => ({
        slug: s.slug,
        title: s.title,
        subtitle: s.subtitle,
        eyebrow: s.eyebrow,
        audiences: s.audiences,
        outcomes: s.outcomes,
        related: s.related,
        url: `/services/${s.slug}`,
      }));
    return {
      content: [{ type: "text", text: JSON.stringify({ count: rows.length, rows }, null, 2) }],
      structuredContent: { count: rows.length, rows },
    };
  },
});