import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SERVICES, SITE, RESOURCES } from "@/lib/site-config";
import {
  discoverStaticPaths,
  expandDynamic,
  hintFor,
} from "../../scripts/sitemap-discover.mjs";

const BASE_URL = "https://velomedos.com";

interface Entry { path: string; changefreq?: string; priority?: string }

// Auto-discover every route file at build time via Vite's import.meta.glob.
// Keys look like "/src/routes/about.tsx" — we only need the paths.
const ROUTE_MODULES = import.meta.glob("/src/routes/**/*.{ts,tsx}");
const ROUTE_FILENAMES = Object.keys(ROUTE_MODULES).map((k) =>
  k.replace(/^\/src\/routes\//, ""),
);

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        // Static routes — derived from src/routes/ at build time.
        const staticEntries: Entry[] = discoverStaticPaths(ROUTE_FILENAMES).map(
          (path: string) => ({ path, ...hintFor(path) }),
        );
        // Dynamic routes — expanded from data sources that mirror the loaders.
        const dynamicEntries: Entry[] = expandDynamic({
          services: SERVICES as unknown as { slug: string }[],
          cities: SITE.cities as unknown as { slug: string }[],
          resources: RESOURCES as unknown as { slug: string }[],
        });
        const entries: Entry[] = [...staticEntries, ...dynamicEntries];
        const urls = entries.map((e) => `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});