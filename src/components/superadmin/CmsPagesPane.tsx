import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { toast } from "sonner";
import { Save, FileText, Rocket, ExternalLink, Undo2, RefreshCw, Trash2 } from "lucide-react";

type Row = {
  key: string; locale: string;
  value: unknown;
  draft_value: unknown | null;
  published_value: unknown | null;
  status: "draft" | "published";
  updated_at?: string;
  published_at?: string | null;
};

const DEFAULT_KEYS = [
  { key: "hero.eyebrow", hint: "Top mono eyebrow on home hero" },
  { key: "hero.headline", hint: "Hero headline (use *italic* markers)" },
  { key: "hero.subcopy", hint: "Hero subcopy paragraph" },
  { key: "hero.note", hint: "Hero compliance note (under subcopy)" },
  { key: "wedge.copy", hint: "Category line between hero and pillars (newlines allowed)" },
  { key: "pillars.eyebrow", hint: "Pillars section eyebrow" },
  { key: "pillars.headline", hint: "Pillars section headline" },
  { key: "pillars.subcopy", hint: "Pillars section subcopy" },
  { key: "pillars.operations.title", hint: "Operations pillar title" },
  { key: "pillars.operations", hint: "Operations pillar copy" },
  { key: "pillars.clinical.title", hint: "Clinical pillar title" },
  { key: "pillars.clinical", hint: "Clinical · HIS pillar copy" },
  { key: "pillars.revenue.title", hint: "Revenue pillar title" },
  { key: "pillars.revenue", hint: "Revenue · RCM pillar copy" },
  { key: "compliance.note", hint: "Compliance strip caption" },
  { key: "cta.eyebrow", hint: "Closing CTA eyebrow" },
  { key: "cta.final", hint: "Closing CTA headline (newlines allowed)" },
  { key: "cta.subcopy", hint: "Closing CTA subcopy" },
];

type FilterMode = "all" | "draft" | "published" | "diverged";

export function CmsPagesPane() {
  const [rows, setRows] = useState<Row[]>([]);
  const [version, setVersion] = useState<{ version: number; bumped_at: string } | null>(null);
  const [locale, setLocale] = useState("en");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterMode>("all");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const data = await adminFetch<{ rows?: Row[]; version?: { version: number; bumped_at: string } | null }>(
        `/api/admin/v1/site-content?locale=${locale}`,
      );
      setRows(data.rows ?? []);
      setVersion(data.version ?? null);
    } catch (e) { toast.error((e as Error).message || "Failed to load CMS rows"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [locale]);

  const map = useMemo(() => new Map(rows.map((r) => [r.key, r] as const)), [rows]);
  const allKeys = useMemo(
    () => Array.from(new Set([...DEFAULT_KEYS.map((k) => k.key), ...rows.map((r) => r.key)])),
    [rows],
  );

  function previewOf(row: Row | undefined): unknown {
    return row?.draft_value ?? row?.published_value ?? null;
  }
  function isDiverged(row: Row | undefined): boolean {
    if (!row) return false;
    if (row.draft_value === null || row.draft_value === undefined) return false;
    return stringify(row.draft_value) !== stringify(row.published_value);
  }

  async function save(key: string, mode: "draft" | "publish") {
    const row = map.get(key);
    const baseline = stringify(previewOf(row));
    const raw = editing[key] ?? baseline;
    let value: unknown = raw;
    try { value = JSON.parse(raw); } catch { /* keep as string */ }
    setBusy(key);
    try {
      await adminFetch("/api/admin/v1/site-content", {
        method: "PUT",
        body: { key, locale, value, status: mode === "publish" ? "published" : "draft" },
      });
      toast.success(`${key} · ${mode === "publish" ? "published" : "saved as draft"}`);
      setEditing((e) => { const c = { ...e }; delete c[key]; return c; });
      await load();
    } catch (e) { toast.error((e as Error).message || "Save failed"); }
    finally { setBusy(null); }
  }

  async function publishDraft(key: string) {
    setBusy(key);
    try {
      await adminFetch("/api/admin/v1/site-content/publish", { method: "POST", body: { key, locale } });
      toast.success(`${key} · draft published`);
      await load();
    } catch (e) { toast.error((e as Error).message || "Publish failed"); }
    finally { setBusy(null); }
  }

  async function publishAll() {
    setBusy("__all__");
    try {
      const r = await adminFetch<{ results: Array<{ ok: boolean }>; version?: number }>(
        "/api/admin/v1/site-content/publish",
        { method: "POST", body: { all: true } },
      );
      const ok = r.results.filter((x) => x.ok).length;
      toast.success(`Published ${ok} draft${ok === 1 ? "" : "s"} · v${r.version ?? "?"} live`);
      await load();
    } catch (e) { toast.error((e as Error).message || "Publish-all failed"); }
    finally { setBusy(null); }
  }

  async function unpublish(key: string) {
    setBusy(key);
    try {
      await adminFetch("/api/admin/v1/site-content/unpublish", { method: "POST", body: { key, locale } });
      toast.success(`${key} · removed from live site`);
      await load();
    } catch (e) { toast.error((e as Error).message || "Unpublish failed"); }
    finally { setBusy(null); }
  }

  async function bumpVersion() {
    setBusy("__bump__");
    try {
      const r = await adminFetch<{ version: number }>("/api/admin/v1/site-content/bump-version", { method: "POST" });
      toast.success(`Marketing site cache busted · v${r.version}`);
      await load();
    } catch (e) { toast.error((e as Error).message || "Cache bump failed"); }
    finally { setBusy(null); }
  }

  async function destroy(key: string) {
    if (!confirm(`Delete CMS row "${key}" (${locale}) completely?`)) return;
    setBusy(key);
    try {
      await adminFetch(`/api/admin/v1/site-content?key=${encodeURIComponent(key)}&locale=${locale}`, { method: "DELETE" });
      toast.success(`${key} · deleted`);
      await load();
    } catch (e) { toast.error((e as Error).message || "Delete failed"); }
    finally { setBusy(null); }
  }

  const divergedCount = rows.filter(isDiverged).length;

  return (
    <section className="rounded-xl border border-hairline bg-panel p-4 lg:p-5 space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="mono text-[10px] uppercase tracking-widest text-teal">Pages &amp; CMS</div>
          <div className="text-base font-semibold flex items-center gap-2"><FileText className="size-4" /> Marketing site content overlay</div>
          <div className="text-xs text-muted-foreground mt-1 max-w-[72ch]">
            Workflow: <span className="mono">edit → Save draft → Preview → Publish</span>. Drafts are isolated from the live site —
            published values stay untouched until you press <b>Publish</b>. The marketing site revalidates against an ETag and
            re-fetches automatically every minute / on tab focus, so updates appear within seconds of publishing.
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className="bg-background border border-hairline rounded px-2 py-1 text-xs">
              <option value="en">en</option><option value="ar">ar</option>
            </select>
            <select value={filter} onChange={(e) => setFilter(e.target.value as FilterMode)} className="bg-background border border-hairline rounded px-2 py-1 text-xs">
              <option value="all">All keys</option>
              <option value="draft">Has draft</option>
              <option value="published">Has published</option>
              <option value="diverged">Draft ≠ Published</option>
            </select>
            <a href="/?cms=preview" target="_blank" rel="noreferrer"
               className="mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded bg-teal/15 text-teal hover:bg-teal/25 inline-flex items-center gap-1.5">
              <ExternalLink className="size-3" /> Preview homepage
            </a>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button disabled={busy === "__all__" || divergedCount === 0}
                    onClick={publishAll}
                    className="mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded bg-coral/15 text-coral hover:bg-coral/25 disabled:opacity-40 inline-flex items-center gap-1.5">
              <Rocket className="size-3" /> Publish all drafts ({divergedCount})
            </button>
            <button disabled={busy === "__bump__"} onClick={bumpVersion}
                    className="mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded border border-hairline hover:bg-panel-elevated disabled:opacity-40 inline-flex items-center gap-1.5">
              <RefreshCw className="size-3" /> Force refresh marketing
            </button>
          </div>
          {version && (
            <div className="mono text-[10px] text-muted-foreground">
              Live cache version <span className="text-foreground">v{version.version}</span> · bumped {new Date(version.bumped_at).toLocaleString()}
            </div>
          )}
        </div>
      </header>

      <div className="space-y-3">
        {allKeys
          .filter((key) => {
            const r = map.get(key);
            if (filter === "all") return true;
            if (filter === "draft") return r?.draft_value != null;
            if (filter === "published") return r?.published_value != null;
            if (filter === "diverged") return isDiverged(r);
            return true;
          })
          .map((key) => {
            const row = map.get(key);
            const hint = DEFAULT_KEYS.find((k) => k.key === key)?.hint;
            const draftText = editing[key] ?? stringify(row?.draft_value ?? row?.published_value);
            const liveText = stringify(row?.published_value);
            const hasDraft = row?.draft_value != null;
            const hasLive = row?.published_value != null;
            const diverged = isDiverged(row);
            return (
              <div key={key} className="rounded-lg border border-hairline bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="mono text-[11px] text-foreground truncate">{key}</div>
                    {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasDraft && (
                      <span className={`mono text-[9.5px] uppercase tracking-widest px-2 py-0.5 rounded ${diverged ? "bg-amber-500/15 text-amber-300" : "bg-hairline text-muted-foreground"}`}>
                        {diverged ? "draft pending" : "draft = live"}
                      </span>
                    )}
                    <span className={`mono text-[9.5px] uppercase tracking-widest px-2 py-0.5 rounded ${hasLive ? "bg-teal/15 text-teal" : "bg-hairline text-muted-foreground"}`}>
                      {hasLive ? "live" : "not on site"}
                    </span>
                  </div>
                </div>

                <textarea
                  value={draftText}
                  onChange={(e) => setEditing((s) => ({ ...s, [key]: e.target.value }))}
                  rows={Math.min(8, Math.max(2, draftText.split("\n").length))}
                  className="w-full bg-background border border-hairline rounded p-2 text-xs mono"
                  placeholder="Plain text or JSON…"
                />

                {hasLive && diverged && (
                  <details className="mt-1.5 text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Show live value (currently on site)</summary>
                    <pre className="mt-1 p-2 rounded bg-background border border-hairline mono text-[11px] whitespace-pre-wrap break-words">{liveText}</pre>
                  </details>
                )}

                <div className="mt-2 flex gap-2 flex-wrap">
                  <button disabled={busy === key} onClick={() => save(key, "draft")}
                          className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated disabled:opacity-40 inline-flex items-center gap-1">
                    <Save className="size-3" /> Save draft
                  </button>
                  {hasDraft && diverged && (
                    <button disabled={busy === key} onClick={() => publishDraft(key)}
                            className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-coral/15 text-coral hover:bg-coral/25 disabled:opacity-40 inline-flex items-center gap-1">
                      <Rocket className="size-3" /> Publish draft → live
                    </button>
                  )}
                  <button disabled={busy === key} onClick={() => save(key, "publish")}
                          className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-teal/15 text-teal hover:bg-teal/25 disabled:opacity-40 inline-flex items-center gap-1">
                    <Rocket className="size-3" /> Save &amp; publish
                  </button>
                  {hasLive && (
                    <button disabled={busy === key} onClick={() => unpublish(key)}
                            className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated disabled:opacity-40 inline-flex items-center gap-1 text-amber-300">
                      <Undo2 className="size-3" /> Unpublish
                    </button>
                  )}
                  <button disabled={busy === key} onClick={() => destroy(key)}
                          className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated disabled:opacity-40 inline-flex items-center gap-1 text-muted-foreground">
                    <Trash2 className="size-3" /> Delete
                  </button>
                  <a href={`/?cms=preview#${encodeURIComponent(key)}`} target="_blank" rel="noreferrer"
                     className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated inline-flex items-center gap-1 ml-auto">
                    <ExternalLink className="size-3" /> Preview
                  </a>
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
