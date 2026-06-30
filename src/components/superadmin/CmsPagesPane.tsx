import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { toast } from "sonner";
import { Save, FileText, Plus } from "lucide-react";

type Row = { key: string; locale: string; value: unknown; status: "draft" | "published"; updated_at?: string };

const DEFAULT_KEYS = [
  { key: "hero.eyebrow", hint: "Top mono eyebrow on home hero" },
  { key: "hero.headline", hint: "Hero headline (use *italic* markers)" },
  { key: "hero.subcopy", hint: "Hero subcopy paragraph" },
  { key: "hero.cta_primary", hint: "Primary CTA label" },
  { key: "hero.cta_secondary", hint: "Secondary CTA label" },
  { key: "pillars.operations", hint: "Operations pillar copy" },
  { key: "pillars.clinical", hint: "Clinical · HIS pillar copy" },
  { key: "pillars.revenue", hint: "Revenue · RCM pillar copy" },
  { key: "compliance.note", hint: "Compliance strip caption" },
  { key: "partner.headline", hint: "Partner section headline" },
  { key: "cta.final", hint: "Closing CTA headline" },
];

export function CmsPagesPane() {
  const [rows, setRows] = useState<Row[]>([]);
  const [locale, setLocale] = useState("en");
  const [editing, setEditing] = useState<Record<string, string>>({});

  async function load() {
    const r = await adminFetch(`/api/admin/v1/site-content?locale=${locale}`);
    if (!r.ok) { toast.error("Failed to load CMS rows"); return; }
    const data = await r.json();
    setRows((data.rows ?? []) as Row[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [locale]);

  const map = new Map(rows.map((r) => [r.key, r] as const));
  const allKeys = Array.from(new Set([...DEFAULT_KEYS.map((k) => k.key), ...rows.map((r) => r.key)]));

  async function save(key: string, status: "draft" | "published") {
    const raw = editing[key] ?? stringify(map.get(key)?.value);
    let value: unknown = raw;
    try { value = JSON.parse(raw); } catch { /* keep as string */ }
    const r = await adminFetch("/api/admin/v1/site-content", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, locale, value, status }),
    });
    if (!r.ok) { toast.error("Save failed"); return; }
    toast.success(`${key} · ${status}`);
    setEditing((e) => { const c = { ...e }; delete c[key]; return c; });
    load();
  }

  return (
    <section className="rounded-xl border border-hairline bg-panel p-4 lg:p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest text-teal">Pages &amp; CMS</div>
          <div className="text-base font-semibold flex items-center gap-2"><FileText className="size-4" /> Marketing site content overlay</div>
          <div className="text-xs text-muted-foreground mt-1">Defaults live in <code className="mono">src/lib/site-config.ts</code>; published rows here override them at runtime via <code className="mono">/api/public/v1/site-content</code>.</div>
        </div>
        <select value={locale} onChange={(e) => setLocale(e.target.value)} className="bg-background border border-hairline rounded px-2 py-1 text-xs">
          <option value="en">en</option><option value="ar">ar</option>
        </select>
      </header>

      <div className="space-y-3">
        {allKeys.map((key) => {
          const row = map.get(key);
          const hint = DEFAULT_KEYS.find((k) => k.key === key)?.hint;
          const draft = editing[key] ?? stringify(row?.value);
          return (
            <div key={key} className="rounded-lg border border-hairline bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="mono text-[11px] text-foreground">{key}</div>
                  {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
                </div>
                <span className={`mono text-[9.5px] uppercase tracking-widest px-2 py-0.5 rounded ${row?.status === "published" ? "bg-teal/15 text-teal" : row ? "bg-amber-500/15 text-amber-300" : "bg-hairline text-muted-foreground"}`}>
                  {row?.status ?? "default"}
                </span>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setEditing((s) => ({ ...s, [key]: e.target.value }))}
                rows={Math.min(8, Math.max(2, draft.split("\n").length))}
                className="w-full bg-background border border-hairline rounded p-2 text-xs mono"
                placeholder="Plain text or JSON…"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={() => save(key, "draft")} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated inline-flex items-center gap-1"><Save className="size-3" /> Save draft</button>
                <button onClick={() => save(key, "published")} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-teal/15 text-teal hover:bg-teal/25 inline-flex items-center gap-1"><Plus className="size-3" /> Publish</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function stringify(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}