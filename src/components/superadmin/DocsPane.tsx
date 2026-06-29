import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Download, Search, FileText, Layers } from "lucide-react";
import { listDocs, getDoc, type DocSlug } from "@/lib/his-docs";

/**
 * Superadmin Documentation hub — reads the bundled HIS/RCM/Changelog manuals
 * via `src/lib/his-docs.ts`. PDF / overlay editing are deferred (see plan).
 */
export function DocsPane() {
  const docs = useMemo(() => listDocs(), []);
  const [slug, setSlug] = useState<DocSlug>(docs[0]?.slug ?? "his-user-manual");
  const [filter, setFilter] = useState("");
  const active = useMemo(() => getDoc(slug), [slug]);

  const toc = useMemo(() => {
    if (!active) return [] as { depth: 2 | 3; text: string; id: string }[];
    const out: { depth: 2 | 3; text: string; id: string }[] = [];
    active.body.split(/\r?\n/).forEach((line) => {
      const m2 = /^##\s+(.+?)\s*$/.exec(line);
      const m3 = /^###\s+(.+?)\s*$/.exec(line);
      const m = m2 ?? m3;
      if (!m) return;
      const text = m[1];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      out.push({ depth: m2 ? 2 : 3, text, id });
    });
    return out;
  }, [active]);

  const filteredToc = filter.trim()
    ? toc.filter((t) => t.text.toLowerCase().includes(filter.toLowerCase()))
    : toc;

  useEffect(() => { setFilter(""); }, [slug]);

  function download() {
    if (!active) return;
    const blob = new Blob([active.body], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${active.slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal flex items-center gap-2"><BookOpen className="size-3" /> Documentation</div>
          <h2 className="text-xl font-semibold tracking-tight mt-1">HIS · RCM · Changelog</h2>
          <p className="text-sm text-muted-foreground mt-1">Manuals are bundled with the release. Tenant admins can <em>request</em> overlay edits via the API; inline editing lands in a future release.</p>
        </div>
        <button onClick={download} className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated inline-flex items-center gap-1.5"><Download className="size-3" /> Download .md</button>
      </header>

      <nav className="flex gap-1 flex-wrap">
        {docs.map((d) => (
          <button key={d.slug} onClick={() => setSlug(d.slug)}
            className={`mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border ${slug === d.slug ? "border-action bg-action/10 text-action" : "border-hairline hover:bg-panel-elevated"}`}>
            <FileText className="inline size-3 mr-1" /> {d.title}
          </button>
        ))}
      </nav>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <aside className="rounded-xl border border-hairline bg-panel p-3 space-y-2 self-start sticky top-4">
          <div className="flex items-center gap-1 bg-panel-elevated rounded px-2 py-1 text-xs">
            <Search className="size-3 text-muted-foreground" />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter sections…" className="bg-transparent outline-none flex-1" />
          </div>
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Layers className="size-3" /> Contents</div>
          <ul className="space-y-0.5 max-h-[60vh] overflow-y-auto">
            {filteredToc.map((t) => (
              <li key={t.id} className={t.depth === 3 ? "pl-3" : ""}>
                <a href={`#${t.id}`} className="block px-2 py-1 rounded text-[12px] text-muted-foreground hover:bg-panel-elevated hover:text-foreground transition">{t.text}</a>
              </li>
            ))}
            {filteredToc.length === 0 && <li className="text-[11px] text-muted-foreground px-2 py-1">No headings match.</li>}
          </ul>
        </aside>

        <article className="rounded-xl border border-hairline bg-panel p-6">
          <div className="prose prose-sm prose-invert max-w-none
            prose-headings:scroll-mt-20
            prose-h1:text-2xl prose-h1:font-semibold prose-h1:tracking-tight
            prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8
            prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6
            prose-p:text-foreground/85 prose-li:text-foreground/85
            prose-code:text-action prose-code:before:content-none prose-code:after:content-none
            prose-a:text-teal hover:prose-a:underline">
            {active ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children, ...props }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    return <h2 id={id} {...props}>{children}</h2>;
                  },
                  h3: ({ children, ...props }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    return <h3 id={id} {...props}>{children}</h3>;
                  },
                }}
              >
                {active.body}
              </ReactMarkdown>
            ) : (
              <p>Manual not found.</p>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-hairline mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            <span>{active?.slug} · v{active?.version} · {active?.source}</span>
            <span>API · /api/clinical/v1/docs/{active?.slug}</span>
          </div>
        </article>
      </div>
    </section>
  );
}