// Shared, framework-agnostic sitemap route discovery.
//
// Consumed by:
//   - src/routes/sitemap[.]xml.ts  (auto-derives sitemap entries at request time)
//   - scripts/audit-sitemap.mjs    (prebuild audit)
//   - src/lib/sitemap/discover.test.ts (integration test)
//
// Rule: a file under src/routes/ is a public, indexable page unless it is
// explicitly excluded here. New public routes therefore appear in the
// sitemap automatically — nothing to maintain by hand.

/** Directory prefixes (relative to src/routes/) whose entire subtree is not public. */
export const EXCLUDE_PATH_PREFIXES = ["_authenticated/", "api/"];

/**
 * Individual files that live under src/routes/ but must not appear in the
 * sitemap. Keep the reason inline — it's the only place these decisions live.
 */
export const EXCLUDE_FILES = new Set([
  "__root.tsx",
  "sitemap[.]xml.ts",
  "robots[.]txt.ts",
  "auth.tsx",
  "auth.error.tsx",
  "superadmin.login.tsx",
  "superadmin.reset.tsx",
  "trip.$token.tsx",            // tokenised per-trip link
  "Privacy.tsx",                // layout shell (leaves live in Privacy.*.tsx)
  "privacy.$.tsx",              // splat redirector
  "resources.$slug.tsx",        // dynamic — expanded via RESOURCES below
  "services.$slug.tsx",         // dynamic — expanded via SERVICES below
  "clinics.$city.tsx",          // dynamic — expanded via SITE.cities below
  "solutions.tsx",              // redirect-only → /services
  "solutions.$slug.tsx",        // redirect-only
  "his.tsx",                    // redirect-only
  "demo-login.tsx",             // sandbox — noindex
  "demo-credentials.tsx",       // sandbox roster — noindex
  "mcp.ts",                     // MCP endpoint, not a page
  "preauth-mid.tsx",            // public kiosk — noindex
]);

/** Convert a route filename (relative to src/routes/) into its URL path. */
export function filenameToPath(rel) {
  let p = rel.replace(/\\/g, "/").replace(/\.(tsx|ts)$/, "").replace(/\./g, "/");
  if (p === "index") return "/";
  p = p.replace(/\/index$/, "");
  return "/" + p;
}

/** True when a route file should contribute a static entry to the sitemap. */
export function isPublicRouteFile(rel) {
  const norm = rel.replace(/\\/g, "/");
  if (!/\.(tsx|ts)$/.test(norm)) return false;
  if (EXCLUDE_PATH_PREFIXES.some((p) => norm.startsWith(p))) return false;
  // Bracketed segments like [.mcp] / [.well-known] are opaque to routing.
  if (norm.split("/").some((seg) => seg.startsWith("["))) return false;
  // Underscore-prefixed segments (_authenticated, _layout) are pathless layouts.
  if (norm.split("/").some((seg) => seg.startsWith("_"))) return false;
  // Dynamic segments must be expanded from a data source, not walked blindly.
  if (norm.includes("$")) return false;
  if (EXCLUDE_FILES.has(norm)) return false;
  return true;
}

/**
 * Given a raw list of filenames (relative to src/routes/), return the sorted,
 * deduplicated URL paths that belong in the sitemap as static entries.
 */
export function discoverStaticPaths(filenames) {
  const paths = new Set();
  for (const rel of filenames) {
    if (!isPublicRouteFile(rel)) continue;
    paths.add(filenameToPath(rel));
  }
  return [...paths].sort();
}

/**
 * Priority + changefreq hints. Any path not listed falls back to defaults.
 * Keeping this small and centralised avoids re-hardcoding metadata inside
 * the sitemap route.
 */
export const PATH_HINTS = {
  "/":                    { changefreq: "weekly",  priority: "1.0" },
  "/platform":            { changefreq: "monthly", priority: "0.9" },
  "/services":            { changefreq: "monthly", priority: "0.9" },
  "/clinics":             { changefreq: "weekly",  priority: "0.8" },
  "/resources":           { changefreq: "weekly",  priority: "0.6" },
  "/resources/comparison":{ changefreq: "monthly", priority: "0.6" },
  "/about":               { changefreq: "monthly", priority: "0.6" },
  "/pricing":             { changefreq: "monthly", priority: "0.6" },
  "/contact":             { changefreq: "monthly", priority: "0.7" },
  "/demo":                { changefreq: "monthly", priority: "0.6" },
  "/demo-tour":           { changefreq: "monthly", priority: "0.5" },
  "/business-intake":     { changefreq: "monthly", priority: "0.5" },
  "/terms":               { changefreq: "yearly",  priority: "0.3" },
  "/website":             { changefreq: "monthly", priority: "0.4" },
};

export const DEFAULT_HINT = { changefreq: "monthly", priority: "0.5" };

export function hintFor(path) {
  return PATH_HINTS[path] ?? DEFAULT_HINT;
}

/** Build dynamic entries (services / clinics / resources). */
export function expandDynamic({ services = [], cities = [], resources = [] } = {}) {
  return [
    ...services.map((s)  => ({ path: `/services/${s.slug}`,  changefreq: "monthly", priority: "0.8" })),
    ...cities.map((c)    => ({ path: `/clinics/${c.slug}`,   changefreq: "weekly",  priority: "0.7" })),
    ...resources.map((r) => ({ path: `/resources/${r.slug}`, changefreq: "monthly", priority: "0.5" })),
  ];
}