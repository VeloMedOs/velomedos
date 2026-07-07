/**
 * Addendum editor — Dev Spec §5 "addendum-not-amend".
 * Original is struck-through; new content becomes a timestamped addendum row.
 */
import { useState } from "react";
import { PenLine } from "lucide-react";

export type Addendum = {
  id: string;
  author_id: string | null;
  author_label: string | null;
  body: string;
  created_at: string;
};

export function AddendumEditor({
  original, addenda, onAppend, locked, authorLabel,
}: {
  original: string;
  addenda: Addendum[];
  onAppend: (body: string) => Promise<void>;
  locked: boolean;
  authorLabel?: string;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!draft.trim()) return;
    setBusy(true);
    try { await onAppend(draft.trim()); setDraft(""); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--clin-faint)" }}>Original (locked)</div>
        <div className="rounded-md px-3 py-2 whitespace-pre-wrap text-[12.5px]"
          style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)", color: "var(--clin-muted)" }}>
          <s>{original || "—"}</s>
        </div>
      </div>
      {addenda.map((a) => (
        <div key={a.id}>
          <div className="mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--clin-faint)" }}>
            Addendum · {a.author_label ?? a.author_id ?? "unknown"} · {new Date(a.created_at).toLocaleString()}
          </div>
          <div className="rounded-md px-3 py-2 whitespace-pre-wrap text-[12.5px]"
            style={{ background: "#fff", border: "1px solid var(--hairline)", color: "var(--clin-ink)" }}>
            {a.body}
          </div>
        </div>
      ))}
      {!locked && (
        <div>
          <textarea className="clin-ctrl w-full" rows={3}
            value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder={`Add an addendum as ${authorLabel ?? "you"} — the original stays as written.`} />
          <button type="button" disabled={busy || !draft.trim()} onClick={submit}
            className="mt-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-[12.5px] disabled:opacity-60"
            style={{ background: "var(--clin-teal-tint)", color: "var(--teal)" }}>
            <PenLine className="size-3.5" />{busy ? "Appending…" : "Append addendum"}
          </button>
        </div>
      )}
    </div>
  );
}