// Integration test for automatic sitemap discovery.
//
// Walks the real src/routes/ tree on disk and runs it through the same
// discovery logic that the sitemap route uses at request time. A public
// route that isn't picked up here will also be missing from
// /sitemap.xml — the test fails with the exact list so the regression is
// obvious well before a deploy.
// @ts-expect-error bun-types conflicts with project types
import { describe, expect, it } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  discoverStaticPaths,
  isPublicRouteFile,
  EXCLUDE_FILES,
  EXCLUDE_PATH_PREFIXES,
} from "../../../scripts/sitemap-discover.mjs";

const ROUTES_DIR = "src/routes";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { out.push(...walk(full)); continue; }
    out.push(relative(ROUTES_DIR, full).split(sep).join("/"));
  }
  return out;
}

const FILES = walk(ROUTES_DIR);
const DISCOVERED = new Set<string>(discoverStaticPaths(FILES));

describe("sitemap discovery — public routes auto-derived from src/routes/", () => {
  // Every page a search engine or shared link would hit must be present.
  const MUST_APPEAR = [
    "/",
    "/about",
    "/contact",
    "/pricing",
    "/platform",
    "/services",
    "/clinics",
    "/resources",
    "/resources/comparison",
    "/demo",
    "/demo-tour",         // regression from earlier turn — must never drop off again
    "/business-intake",
    "/terms",
    "/website",
  ];

  for (const path of MUST_APPEAR) {
    it(`includes ${path}`, () => {
      if (!DISCOVERED.has(path)) {
        const nearby = [...DISCOVERED].filter((p) => p.startsWith(path.slice(0, 4)));
        throw new Error(
          `sitemap discovery missing ${path}. Nearby discovered: ${nearby.join(", ") || "(none)"}`,
        );
      }
      expect(DISCOVERED.has(path)).toBe(true);
    });
  }

  it("has no orphan EXCLUDE_FILES (all excluded files exist on disk)", () => {
    const stale: string[] = [];
    for (const f of EXCLUDE_FILES as Set<string>) {
      const p = join(ROUTES_DIR, f);
      try { statSync(p); } catch { stale.push(f); }
    }
    if (stale.length) {
      throw new Error(
        "Stale entries in EXCLUDE_FILES (files no longer exist):\n  " +
        stale.join("\n  "),
      );
    }
  });

  it("rejects no public-looking .tsx route files by accident", () => {
    const rejected = FILES.filter((rel) => {
      if (isPublicRouteFile(rel)) return false;
      if (!/\.(tsx|ts)$/.test(rel)) return false;
      if (EXCLUDE_PATH_PREFIXES.some((p: string) => rel.startsWith(p))) return false;
      if (rel.split("/").some((s) => s.startsWith("[") || s.startsWith("_"))) return false;
      if (rel.includes("$")) return false;
      if ((EXCLUDE_FILES as Set<string>).has(rel)) return false;
      return true;
    });
    if (rejected.length) {
      throw new Error(
        "Public-looking route files rejected by discovery filter:\n  " +
        rejected.map((r) => "src/routes/" + r).join("\n  "),
      );
    }
  });
});