#!/usr/bin/env node
/**
 * Prebuild sitemap audit.
 *
 * Walks src/routes/ on disk and passes the filenames through the SAME
 * discovery logic used by src/routes/sitemap[.]xml.ts at request time
 * (scripts/sitemap-discover.mjs). Because the sitemap is auto-derived,
 * every public route file automatically becomes a sitemap entry — this
 * script's job is to:
 *
 *   1. Fail loudly if a public route file is somehow rejected by the
 *      discovery filter (typos, accidental underscore, missing extension).
 *   2. Warn when an entry in EXCLUDE_FILES no longer maps to a real file
 *      (stale exclusions).
 *
 * Runs on `bun run build` via the `prebuild` npm hook.
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  EXCLUDE_FILES,
  EXCLUDE_PATH_PREFIXES,
  discoverStaticPaths,
  isPublicRouteFile,
} from "./sitemap-discover.mjs";

const ROUTES_DIR = "src/routes";

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { out.push(...walk(full)); continue; }
    out.push(relative(ROUTES_DIR, full).split(sep).join("/"));
  }
  return out;
}

const files = walk(ROUTES_DIR);
const discovered = new Set(discoverStaticPaths(files));

// Detect "public-looking" files that were rejected by the discovery filter
// for reasons OTHER than the intentional excludes (excluded prefix, dynamic
// segment, bracket, underscore, or explicit EXCLUDE_FILES entry). If a page
// route ever lands in this list it means the filter has a bug or the file
// is misnamed — the build must fail.
const suspicious = files.filter((rel) => {
  if (isPublicRouteFile(rel)) return false;
  if (!/\.(tsx|ts)$/.test(rel)) return false;
  if (EXCLUDE_PATH_PREFIXES.some((p) => rel.startsWith(p))) return false;
  if (rel.split("/").some((s) => s.startsWith("[") || s.startsWith("_"))) return false;
  if (rel.includes("$")) return false;
  if (EXCLUDE_FILES.has(rel)) return false;
  return true;
});

const staleExcludes = [...EXCLUDE_FILES].filter(
  (f) => !existsSync(join(ROUTES_DIR, f)),
);

let failed = false;

if (suspicious.length) {
  failed = true;
  console.error("✗ sitemap audit: public route files rejected by discovery filter:");
  for (const f of suspicious) console.error("    src/routes/" + f);
  console.error("  → Either the file is misnamed, or the filter in");
  console.error("    scripts/sitemap-discover.mjs needs updating.");
}

if (staleExcludes.length) {
  console.warn("⚠ sitemap audit: EXCLUDE_FILES entries with no matching file (stale):");
  for (const f of staleExcludes) console.warn("    " + f);
}

if (!failed) {
  console.log(
    `✓ sitemap audit: ${discovered.size} public routes auto-discovered ` +
    `(sitemap is derived from src/routes/ at request time)`,
  );
  if (process.env.SITEMAP_AUDIT_VERBOSE) {
    for (const p of [...discovered].sort()) console.log("    " + p);
  }
}

process.exit(failed ? 1 : 0);