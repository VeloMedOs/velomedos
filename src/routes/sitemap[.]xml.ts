import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SERVICES, SITE, RESOURCES } from "@/lib/site-config";

const BASE_URL = "https://velomedos.com";

interface Entry { path: string; changefreq?: string; priority?: string }

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const entries: Entry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/platform", changefreq: "monthly", priority: "0.9" },
          { path: "/services", changefreq: "monthly", priority: "0.9" },
          ...SERVICES.map((s) => ({ path: `/services/${s.slug}`, changefreq: "monthly", priority: "0.8" })),
          { path: "/clinics", changefreq: "weekly", priority: "0.8" },
          ...SITE.cities.map((c) => ({ path: `/clinics/${c.slug}`, changefreq: "weekly", priority: "0.7" })),
          { path: "/resources", changefreq: "weekly", priority: "0.6" },
          ...RESOURCES.map((r) => ({ path: `/resources/${r.slug}`, changefreq: "monthly", priority: "0.5" })),
          { path: "/resources/comparison", changefreq: "monthly", priority: "0.6" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/pricing", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.7" },
          { path: "/demo", changefreq: "monthly", priority: "0.6" },
          { path: "/demo-tour", changefreq: "monthly", priority: "0.5" },
          { path: "/business-intake", changefreq: "monthly", priority: "0.5" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/website", changefreq: "monthly", priority: "0.4" },
          { path: "/Privacy",                changefreq: "monthly", priority: "0.5" },
          { path: "/Privacy/Home",           changefreq: "monthly", priority: "0.5" },
          { path: "/Privacy/TermsOfService", changefreq: "monthly", priority: "0.5" },
          { path: "/Privacy/HIPAA",          changefreq: "monthly", priority: "0.5" },
          { path: "/Privacy/PatientRights",  changefreq: "monthly", priority: "0.5" },
        ];
        const urls = entries.map((e) => `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});