#!/usr/bin/env node
/**
 * Build-time sitemap audit.
 *
 * Walks src/routes/ for public file-based routes and checks that every
 * one of them is listed in the static entries[] array inside
 * src/routes/sitemap[.]xml.ts. Authenticated routes (under
 * `_authenticated/`), API routes (under `api/`), dynamic `$param` routes,
 * splats, and the sitemap/auth shells are excluded by design.
 *
 * Run via:  node scripts/audit-sitemap.mjs
 * Fails non-zero if a public route is missing from the sitemap so it can
 * gate CI / pre-deploy.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROUTES_DIR = "src/routes";
const SITEMAP_FILE = "src/routes/sitemap[.]xml.ts";

const EXCLUDE_PREFIXES = ["_authenticated/", "api/"];
const EXCLUDE_FILES = new Set([
  "__root.tsx",
  "sitemap[.]xml.ts",
  "robots[.]txt.ts",
  "auth.tsx",
  "auth.error.tsx",
  "superadmin.login.tsx",
  "superadmin.reset.tsx",
  "trip.$token.tsx",            // tokenised, per-trip — not for sitemap
  "Privacy.tsx",                // layout shell
  "privacy.$.tsx",              // splat redirector
  "resources.$slug.tsx",        // dynamic, sitemap lists per slug via SERVICES/RESOURCES
  "services.$slug.tsx",
  "clinics.$city.tsx",
  "solutions.tsx",              // redirect-only → /services
  "solutions.$slug.tsx",        // redirect-only → /services/:slug
  "his.tsx",                    // redirect-only → /launch or /auth
  "demo-login.tsx",             // sandbox demo entry — noindex
  "demo-credentials.tsx",       // sandbox roster — noindex
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROUTES_DIR, full);
    if (statSync(full).isDirectory()) { out.push(...walk(full)); continue; }
    if (!/\.(tsx|ts)$/.test(name)) continue;
    if (EXCLUDE_PREFIXES.some((p) => rel.startsWith(p))) continue;
    if (EXCLUDE_FILES.has(rel)) continue;
    if (name.startsWith("_")) continue;
    out.push(rel);
  }
  return out;
}

function filenameToPath(rel) {
  // strip extension, convert dots → slashes, drop trailing /index
  let p = rel.replace(/\.(tsx|ts)$/, "").replace(/\./g, "/");
  if (p === "index") return "/";
  p = p.replace(/\/index$/, "");
  return "/" + p;
}

const files = walk(ROUTES_DIR);
const expected = new Set(files.map(filenameToPath));

const sitemap = readFileSync(SITEMAP_FILE, "utf8");
// Extract every `path: "..."` literal in entries[]
const declared = new Set(
  Array.from(sitemap.matchAll(/path:\s*["'`]([^"'`]+)["'`]/g)).map((m) => m[1])
);
// SERVICES/RESOURCES/cities are spread in — we trust those for $slug routes.
// We only diff the static routes here.

const missing = [...expected].filter((p) => !declared.has(p));
const unknown = [...declared].filter(
  (p) => !expected.has(p) && !p.includes("/") === false && !/^(\/services\/|\/clinics\/|\/resources\/[a-z])/i.test(p),
).filter((p) => !expected.has(p) && !/^\/(services|clinics|resources)\//.test(p));

let failed = false;
if (missing.length) {
  failed = true;
  console.error("✗ sitemap audit: public routes missing from sitemap entries[]:");
  for (const p of missing) console.error("    " + p);
}
if (unknown.length) {
  console.warn("⚠ sitemap audit: entries declared but no matching route file (orphan):");
  for (const p of unknown) console.warn("    " + p);
}
if (!failed) {
  console.log(`✓ sitemap audit: ${expected.size} public routes present in ${SITEMAP_FILE}`);
}
process.exit(failed ? 1 : 0);