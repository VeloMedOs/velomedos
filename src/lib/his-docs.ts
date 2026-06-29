/**
 * HIS documentation manifest.
 *
 * Workers/serverless runtime has no repo `fs` at request time, so the manuals
 * are bundled at build time via Vite `?raw` imports. All API handlers and
 * the Superadmin docs UI read from this single module — never deep relative
 * `?raw` imports inside individual route files.
 *
 * Write/overlay path (DB-backed `his_doc` table) is deferred. PUT /docs/{slug}
 * currently returns 501 with a clear message.
 */
import hisUser from "../../docs/his-user-manual.md?raw";
import hisTechnical from "../../docs/his-technical-manual.md?raw";
import hisRcm from "../../docs/his-rcm-user-manual.md?raw";
import changelog from "../../docs/changelog.md?raw";

export type DocSlug = "his-user-manual" | "his-technical-manual" | "his-rcm-user-manual" | "changelog";

export type DocEntry = {
  slug: DocSlug;
  title: string;
  audience: "clinical" | "rcm" | "engineering" | "all";
  body: string;
  source: "bundled";
  version: string;
};

const ENTRIES: DocEntry[] = [
  { slug: "his-user-manual",      title: "HIS User Manual",      audience: "clinical",    body: hisUser,      source: "bundled", version: "1.0.0" },
  { slug: "his-technical-manual", title: "HIS Technical Manual", audience: "engineering", body: hisTechnical, source: "bundled", version: "1.0.0" },
  { slug: "his-rcm-user-manual",  title: "RCM User Manual",      audience: "rcm",         body: hisRcm,       source: "bundled", version: "0.1.0" },
  { slug: "changelog",            title: "Changelog",            audience: "all",         body: changelog,    source: "bundled", version: "rolling" },
];

export function listDocs(): Omit<DocEntry, "body">[] {
  return ENTRIES.map(({ body: _b, ...rest }) => rest);
}

export function getDoc(slug: string): DocEntry | null {
  return ENTRIES.find((d) => d.slug === slug) ?? null;
}

/**
 * Slice a markdown document by `## <anchor>` heading. The anchor is matched
 * case-insensitively against either the literal heading text or its slug
 * (lowercased, non-alphanum → `-`). Returns everything from the matching
 * heading up to the next `##` (or end of file).
 */
export function sliceDocByModule(doc: DocEntry, anchor: string): string | null {
  const normalized = anchor.toLowerCase().trim();
  const lines = doc.body.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^##\s+(.+?)\s*$/.exec(lines[i]);
    if (!m) continue;
    const heading = m[1];
    const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (heading.toLowerCase() === normalized || slug === normalized.replace(/^-|-$/g, "")) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let j = start + 1; j < lines.length; j++) {
    if (/^##\s+/.test(lines[j])) { end = j; break; }
  }
  return lines.slice(start, end).join("\n");
}