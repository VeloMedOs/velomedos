import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";

/**
 * Public marketing-site content overlay. Returns published rows only.
 * Shape: { content: { [key]: { [locale]: value } } }
 */
export const Route = createFileRoute("/api/public/v1/site-content")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        const db = serviceClient();
        let q = db.from("site_content").select("key, locale, value").eq("status", "published");
        if (key) q = q.eq("key", key);
        const { data, error } = await q;
        if (error) return json({ content: {} });
        const content: Record<string, Record<string, unknown>> = {};
        for (const row of (data ?? []) as Array<{ key: string; locale: string; value: unknown }>) {
          (content[row.key] ||= {})[row.locale] = row.value;
        }
        return json({ content, generated_at: new Date().toISOString() });
      },
    },
  },
});