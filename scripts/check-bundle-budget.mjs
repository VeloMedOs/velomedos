#!/usr/bin/env node
/**
 * VeloMed OS · Bundle budget enforcer.
 *
 * Reads `bundle-budgets.json`, walks the built client assets directory,
 * computes per-file gzipped size, and exits non-zero when any pattern
 * exceeds its budget. Use `ANALYZE=true bun run build` first if you
 * want a treemap (dist/bundle-report.html) alongside this report.
 *
 * Usage:
 *   bun run build
 *   node scripts/check-bundle-budget.mjs
 */
import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();
const cfgPath = join(ROOT, "bundle-budgets.json");
if (!existsSync(cfgPath)) {
  console.error("✖ bundle-budgets.json not found at project root");
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const assetsDir = join(ROOT, cfg.assetsDir);
if (!existsSync(assetsDir)) {
  console.error(`✖ Build artifacts missing: ${cfg.assetsDir}. Run \`bun run build\` first.`);
  process.exit(2);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Minimal glob: supports ** and *
function globToRegex(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DSTAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DSTAR::/g, ".*");
  return new RegExp("^" + re + "$");
}

const files = walk(assetsDir).map((abs) => {
  const buf = readFileSync(abs);
  const gz = gzipSync(buf, { level: 9 }).length;
  return {
    abs,
    rel: relative(assetsDir, abs).split(sep).join("/"),
    raw: buf.length,
    gz,
  };
});

const fmt = (b) => (b / 1024).toFixed(1) + " KB";
const violations = [];
const matched = new Set();

console.log(`\n📦 Bundle budget report — ${cfg.assetsDir}`);
console.log("─".repeat(78));

for (const budget of cfg.budgets) {
  const re = globToRegex(budget.pattern);
  const hits = files.filter((f) => re.test(f.rel));
  if (hits.length === 0) {
    console.log(`◌ ${budget.label.padEnd(22)} (${budget.pattern}) — no asset matched`);
    continue;
  }
  for (const h of hits) {
    matched.add(h.rel);
    const pct = (h.gz / 1024 / budget.maxGzipKB) * 100;
    const status = h.gz / 1024 > budget.maxGzipKB ? "✖" : "✓";
    const line = `${status} ${budget.label.padEnd(22)} ${h.rel.padEnd(40)} ${fmt(h.gz).padStart(10)} gz / budget ${budget.maxGzipKB} KB (${pct.toFixed(0)}%)`;
    console.log(line);
    if (h.gz / 1024 > budget.maxGzipKB) {
      violations.push({ ...budget, file: h.rel, gzKB: h.gz / 1024 });
    }
  }
}

// Totals
const totalJs = files.filter((f) => f.rel.endsWith(".js")).reduce((a, b) => a + b.gz, 0);
const totalCss = files.filter((f) => f.rel.endsWith(".css")).reduce((a, b) => a + b.gz, 0);
console.log("─".repeat(78));
console.log(`Σ JS gzip total : ${fmt(totalJs).padStart(10)}  / budget ${cfg.totals.js.maxGzipKB} KB`);
console.log(`Σ CSS gzip total: ${fmt(totalCss).padStart(10)}  / budget ${cfg.totals.css.maxGzipKB} KB`);
if (totalJs / 1024 > cfg.totals.js.maxGzipKB)  violations.push({ label: cfg.totals.js.label,  file: "Σ js",  gzKB: totalJs / 1024,  maxGzipKB: cfg.totals.js.maxGzipKB });
if (totalCss / 1024 > cfg.totals.css.maxGzipKB) violations.push({ label: cfg.totals.css.label, file: "Σ css", gzKB: totalCss / 1024, maxGzipKB: cfg.totals.css.maxGzipKB });

if (violations.length) {
  console.error(`\n✖ ${violations.length} bundle budget violation(s):`);
  for (const v of violations) {
    console.error(`  • ${v.label} — ${v.file} = ${v.gzKB.toFixed(1)} KB gz (budget ${v.maxGzipKB} KB)`);
  }
  console.error(`\nTip: ANALYZE=true bun run build → open dist/bundle-report.html to investigate.`);
  process.exit(1);
}
console.log(`\n✓ All bundle budgets satisfied.`);