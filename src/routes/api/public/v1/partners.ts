import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";

/**
 * Public partners marquee — reads the `public_partners` view which only
 * surfaces rows where display_publicly AND display_consent are true.
 * No contact PII is exposed.
 */
export const Route = createFileRoute("/api/public/v1/partners")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async () => {
        const db = serviceClient();
        const { data, error } = await db
          .from("public_partners")
          .select("name, city, type, logo_url, featured_order")
          .order("featured_order", { ascending: true })
          .limit(60);
        if (error) return json({ count: 0, items: [] });
        const items = (data ?? []).map((r: any) => ({
          name: r.name as string,
          city: r.city as string | null,
          type: r.type as string | null,
          logo_url: r.logo_url as string | null,
        }));
        return json({ count: items.length, items, generated_at: new Date().toISOString() });
      },
    },
  },
});