import { useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { LegalRenderer } from "@/components/legal/LegalRenderer";
import { History, Save, Send, CheckCircle2, Archive, FileWarning, Eye, Download, X } from "lucide-react";

type Slug   = "privacy-home" | "terms-of-service" | "hipaa" | "patient-rights";
type Locale = "en" | "ar";
type Status = "draft" | "in_review" | "published" | "archived";

type Doc = {
  id: string; slug: Slug; locale: Locale; title: string; summary: string | null;
  body_md: string; status: Status; version: number; effective_date: string | null;
  published_at: string | null; updated_at: string;
};

const SLUGS: { slug: Slug; label: string; path: string }[] = [
  { slug: "privacy-home",     label: "Privacy Notice",        path: "/Privacy/Home" },
  { slug: "terms-of-service", label: "Terms of Service",      path: "/Privacy/TermsOfService" },
  { slug: "hipaa",            label: "HIPAA-Aligned",         path: "/Privacy/HIPAA" },
  { slug: "patient-rights",   label: "Patient Rights",        path: "/Privacy/PatientRights" },
];

const STATUS_COLOR: Record<Status, string> = {
  draft:     "bg-muted/40 text-muted-foreground",
  in_review: "bg-amber-500/15 text-amber-300",
  published: "bg-teal/15 text-teal",
  archived:  "bg-coral/15 text-coral",
};

const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9_ /]*\]/g;

export function LegalCmsModule() {
  const [view, setView] = useState<"list" | "edit" | "history" | "acceptances">("list");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<Doc | null>(null);

  async function reload() {
    setLoading(true); setErr(null);
    try {
      const r = await adminFetch<{ rows: Doc[] }>("/api/admin/v1/legal-documents?orderBy=slug");
      setDocs(r.rows);
    } catch (e: any) { setErr(e?.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  // Translation coverage: AR behind EN?
  const coverage = useMemo(() => {
    const map: Record<string, { en?: Doc; ar?: Doc }> = {};
    for (const d of docs) (map[d.slug] ||= {})[d.locale] = d;
    return map;
  }, [docs]);

  if (view === "edit" && active) {
    return <DocEditor doc={active} onBack={() => { setView("list"); setActive(null); reload(); }} onHistory={() => setView("history")} />;
  }
  if (view === "history" && active) {
    return <HistoryView slug={active.slug} locale={active.locale} onBack={() => setView("edit")} />;
  }
  if (view === "acceptances") {
    return <AcceptancesView onBack={() => setView("list")} />;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-teal/30 bg-teal/5 p-4 flex items-start justify-between gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal">Legal &amp; Compliance CMS</div>
          <h2 className="text-lg font-semibold mt-0.5">Privacy &amp; legal documents</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Authoring, versioning, EN/AR translation, and publishing for the public <span className="mono text-teal">/Privacy/*</span> routes.
            Every publish writes an immutable snapshot to the version history. Aligned with PDPL / NDMO / NCA / MOH-NPHIES-CHI; HIPAA optional.
          </p>
        </div>
        <button onClick={() => setView("acceptances")} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel">
          <CheckCircle2 className="size-3" /> Consent register
        </button>
      </div>

      {err && <div className="rounded-md border border-coral/40 bg-coral/10 text-coral text-xs p-3">{err}</div>}
      {loading && <div className="text-xs text-muted-foreground">Loading…</div>}

      <div className="rounded-xl border border-hairline overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel/40 mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Document</th>
              <th className="text-left px-3 py-2">Locale</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">v</th>
              <th className="text-left px-3 py-2">Effective</th>
              <th className="text-left px-3 py-2">Updated</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {SLUGS.flatMap(({ slug, label, path }) =>
              (["en","ar"] as Locale[]).map((locale) => {
                const d = docs.find((x) => x.slug === slug && x.locale === locale);
                const en = coverage[slug]?.en;
                const behind = locale === "ar" && en && d && d.version < en.version;
                return (
                  <tr key={`${slug}-${locale}`} className="border-t border-hairline hover:bg-panel/30">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{label}</div>
                      <a className="mono text-[10px] text-teal" href={`${path}?locale=${locale}`} target="_blank" rel="noreferrer">{path}</a>
                    </td>
                    <td className="px-3 py-2 mono text-[11px]">{locale.toUpperCase()}{behind && <span className="ml-2 inline-flex items-center gap-1 text-amber-300"><FileWarning className="size-3" />behind EN</span>}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full mono text-[10px] uppercase ${d ? STATUS_COLOR[d.status] : "bg-muted/40 text-muted-foreground"}`}>{d?.status ?? "missing"}</span></td>
                    <td className="px-3 py-2 mono text-xs">{d?.version ?? "—"}</td>
                    <td className="px-3 py-2 mono text-xs">{d?.effective_date ?? "—"}</td>
                    <td className="px-3 py-2 mono text-[11px] text-muted-foreground">{d?.updated_at ? new Date(d.updated_at).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2">
                      {d ? (
                        <button onClick={() => { setActive(d); setView("edit"); }} className="text-teal mono text-[11px] uppercase tracking-widest hover:underline">Edit</button>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DocEditor({ doc, onBack, onHistory }: { doc: Doc; onBack: () => void; onHistory: () => void }) {
  const [form, setForm] = useState<Doc>(doc);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const placeholders = Array.from(new Set(form.body_md.match(PLACEHOLDER_RE) ?? []));
  const canPublish = placeholders.length === 0 && !!form.effective_date && form.title.trim().length > 0;

  async function save(nextStatus?: Status) {
    setSaving(true); setMsg(null); setErr(null);
    try {
      const patch: Record<string, unknown> = {
        id: form.id, title: form.title, summary: form.summary, body_md: form.body_md,
        effective_date: form.effective_date, locale: form.locale, slug: form.slug,
      };
      if (nextStatus && nextStatus !== "published") patch.status = nextStatus;
      await adminFetch("/api/admin/v1/legal-documents", { method: "PATCH", body: patch });
      if (nextStatus === "published") {
        const r = await adminFetch<{ ok: boolean; version: number }>(`/api/admin/v1/legal-documents/${form.id}/publish`, {
          method: "POST", body: { change_note: changeNote, effective_date: form.effective_date },
        });
        setForm((f) => ({ ...f, status: "published", version: r.version }));
      } else if (nextStatus) {
        setForm((f) => ({ ...f, status: nextStatus }));
      }
      setMsg("Saved");
    } catch (e: any) { setErr(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">← Back</button>
          <h2 className="text-lg font-semibold mt-1">{form.title} <span className="mono text-xs text-muted-foreground">{form.slug} · {form.locale.toUpperCase()} · v{form.version}</span></h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onHistory} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel"><History className="size-3"/>History</button>
          <a href={`/Privacy/${form.slug === "privacy-home" ? "Home" : form.slug === "terms-of-service" ? "TermsOfService" : form.slug === "hipaa" ? "HIPAA" : "PatientRights"}?locale=${form.locale}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel"><Eye className="size-3"/>View live</a>
        </div>
      </div>

      {(msg || err) && (
        <div className={`text-xs rounded-md p-2 ${err ? "bg-coral/10 text-coral border border-coral/30" : "bg-teal/10 text-teal border border-teal/30"}`}>{err ?? msg}</div>
      )}

      <div className="grid lg:grid-cols-[1fr_1fr] gap-3">
        <div className="space-y-2">
          <label className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-panel border border-hairline rounded-md px-3 py-2 text-sm" />
          <label className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>Summary (SEO)</label>
          <textarea value={form.summary ?? ""} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={2}
            className="w-full bg-panel border border-hairline rounded-md px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>Effective date</label>
              <input type="date" value={form.effective_date ?? ""} onChange={(e) => setForm({ ...form, effective_date: e.target.value })}
                className="w-full bg-panel border border-hairline rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>Status</label>
              <div className={`px-2 py-2 rounded-md mono text-[11px] uppercase ${STATUS_COLOR[form.status]}`}>{form.status}</div>
            </div>
          </div>
          <label className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>Body (Markdown)</label>
          <textarea value={form.body_md} onChange={(e) => setForm({ ...form, body_md: e.target.value })} rows={26}
            className="w-full bg-panel border border-hairline rounded-md px-3 py-2 mono text-[12px] leading-6" dir={form.locale === "ar" ? "rtl" : "ltr"} />

          <label className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>Change note (required for publish)</label>
          <input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="e.g. Updated breach-notification timeline; clarified Processor role"
            className="w-full bg-panel border border-hairline rounded-md px-3 py-2 text-sm" />

          {placeholders.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs p-3">
              <div className="font-semibold mb-1">Publish blocked — {placeholders.length} placeholder{placeholders.length === 1 ? "" : "s"} unresolved:</div>
              <div className="mono text-[11px]">{placeholders.join(", ")}</div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-hairline bg-panel/40 p-4 max-h-[78vh] overflow-auto">
          <div className="brand-eyebrow text-muted-foreground mb-2" style={{ color: "var(--color-muted-foreground)" }}>Preview</div>
          <div dir={form.locale === "ar" ? "rtl" : "ltr"} style={form.locale === "ar" ? { fontFamily: '"IBM Plex Sans Arabic","Noto Naskh Arabic",sans-serif' } : undefined}>
            <LegalRenderer markdown={form.body_md} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button disabled={saving} onClick={() => save("draft")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel">
          <Save className="size-3" /> Save draft
        </button>
        <button disabled={saving} onClick={() => save("in_review")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel">
          <Send className="size-3" /> Submit for review
        </button>
        <button disabled={saving || !canPublish || changeNote.trim().length < 3}
          onClick={() => save("published")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md mono text-[10px] uppercase tracking-widest font-bold text-background disabled:opacity-40"
          style={{ background: "var(--gradient-brand)" }}>
          <CheckCircle2 className="size-3" /> Publish
        </button>
        <button disabled={saving} onClick={() => save("archived")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-coral/40 text-coral mono text-[10px] uppercase tracking-widest hover:bg-coral/10">
          <Archive className="size-3" /> Archive
        </button>
      </div>
    </section>
  );
}

function HistoryView({ slug, locale, onBack }: { slug: Slug; locale: Locale; onBack: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  useEffect(() => {
    adminFetch<{ rows: any[] }>(`/api/admin/v1/legal-documents/history?slug=${slug}&locale=${locale}`)
      .then((r) => setRows(r.rows)).catch(() => setRows([]));
  }, [slug, locale]);
  return (
    <section className="space-y-4">
      <button onClick={onBack} className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">← Back</button>
      <h2 className="text-lg font-semibold">Version history — {slug} · {locale.toUpperCase()}</h2>
      <div className="rounded-xl border border-hairline overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel/40 mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr><th className="text-left px-3 py-2">v</th><th className="text-left px-3 py-2">Effective</th><th className="text-left px-3 py-2">Change note</th><th className="text-left px-3 py-2">Snapshot</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">No versions yet — publish to create v1.</td></tr>}
            {rows.map((r) => (
              <tr key={r.version} className="border-t border-hairline hover:bg-panel/30">
                <td className="px-3 py-2 mono">v{r.version}</td>
                <td className="px-3 py-2 mono text-xs">{r.effective_date ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.change_note ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2 mono text-[11px] text-muted-foreground">{new Date(r.snapshot_at).toLocaleString()}</td>
                <td className="px-3 py-2"><button onClick={() => setOpen(r)} className="text-teal mono text-[10px] uppercase tracking-widest hover:underline">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-6" onClick={() => setOpen(null)}>
          <div className="max-w-3xl w-full max-h-[80vh] overflow-auto rounded-xl border border-hairline bg-panel p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><div className="brand-eyebrow text-teal">v{open.version} · {open.effective_date ?? "—"}</div><div className="text-lg font-semibold">{open.title}</div></div>
              <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4"/></button>
            </div>
            <div dir={locale === "ar" ? "rtl" : "ltr"}><LegalRenderer markdown={open.body_md} /></div>
          </div>
        </div>
      )}
    </section>
  );
}

function AcceptancesView({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<{ slug?: string; locale?: string }>({});
  useEffect(() => {
    const qs = new URLSearchParams();
    if (filter.slug) qs.set("slug", filter.slug);
    if (filter.locale) qs.set("locale", filter.locale);
    adminFetch<{ rows: any[] }>(`/api/admin/v1/legal-documents/acceptances?${qs.toString()}`)
      .then((r) => setRows(r.rows)).catch(() => setRows([]));
  }, [filter]);
  const csvHref = `/api/admin/v1/legal-documents/acceptances?format=csv${filter.slug ? `&slug=${filter.slug}` : ""}${filter.locale ? `&locale=${filter.locale}` : ""}`;
  return (
    <section className="space-y-4">
      <button onClick={onBack} className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">← Back</button>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Consent register (PDPL evidence)</h2>
          <p className="text-xs text-muted-foreground mt-1">Hash-only IP storage — raw IPs are never persisted.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter.slug ?? ""} onChange={(e) => setFilter({ ...filter, slug: e.target.value || undefined })} className="bg-panel border border-hairline rounded-md px-2 py-1.5 text-xs">
            <option value="">All documents</option>
            {SLUGS.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
          <select value={filter.locale ?? ""} onChange={(e) => setFilter({ ...filter, locale: e.target.value || undefined })} className="bg-panel border border-hairline rounded-md px-2 py-1.5 text-xs">
            <option value="">All locales</option><option value="en">EN</option><option value="ar">AR</option>
          </select>
          <a href={csvHref} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel"><Download className="size-3"/>CSV</a>
        </div>
      </div>
      <div className="rounded-xl border border-hairline overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel/40 mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr><th className="text-left px-3 py-2">Document</th><th className="text-left px-3 py-2">Locale</th><th className="text-left px-3 py-2">v</th><th className="text-left px-3 py-2">Subject</th><th className="text-left px-3 py-2">IP hash</th><th className="text-left px-3 py-2">When</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">No acceptances recorded.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-hairline">
                <td className="px-3 py-2 mono text-xs">{r.slug}</td>
                <td className="px-3 py-2 mono text-xs">{r.locale}</td>
                <td className="px-3 py-2 mono text-xs">v{r.version}</td>
                <td className="px-3 py-2 text-xs">{r.subject_email ?? r.subject_id ?? <span className="text-muted-foreground">anonymous</span>}</td>
                <td className="px-3 py-2 mono text-[10px] text-muted-foreground truncate max-w-[160px]">{r.ip_hash ? r.ip_hash.slice(0, 16) + "…" : "—"}</td>
                <td className="px-3 py-2 mono text-[11px] text-muted-foreground">{new Date(r.accepted_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}