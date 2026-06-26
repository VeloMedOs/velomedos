import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SERVICES, SITE, RESOURCES } from "@/lib/site-config";

// TODO: replace with your project URL once a project name or custom domain is set.
const BASE_URL = "";

interface Entry { path: string; changefreq?: string; priority?: string }

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const entries: Entry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/services", changefreq: "monthly", priority: "0.9" },
          ...SERVICES.map((s) => ({ path: `/services/${s.slug}`, changefreq: "monthly", priority: "0.8" })),
          { path: "/clinics", changefreq: "weekly", priority: "0.8" },
          ...SITE.cities.map((c) => ({ path: `/clinics/${c.slug}`, changefreq: "weekly", priority: "0.7" })),
          { path: "/developers", changefreq: "monthly", priority: "0.7" },
          { path: "/api-docs", changefreq: "monthly", priority: "0.6" },
          { path: "/resources", changefreq: "weekly", priority: "0.6" },
          ...RESOURCES.map((r) => ({ path: `/resources/${r.slug}`, changefreq: "monthly", priority: "0.5" })),
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/pricing", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.7" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];
        const urls = entries.map((e) => `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});