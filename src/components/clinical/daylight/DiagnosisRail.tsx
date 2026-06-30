import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Star, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { searchIcd, type IcdEntry } from "@/lib/clinical/icd10-common";

export type DxRow = {
  id: string;
  code: string;
  display?: string | null;
  rank?: number | string | null;
  role?: string | null;
};

/**
 * ICD-10-AM diagnosis editor — typeahead search, PRIMARY/SECONDARY chips,
 * per-chip rank toggle and remove. All mutations optimistic with toast
 * rollback. Source of truth is `ClinicalAPI.listDiagnoses(encId)`.
 */
export function DiagnosisRail({
  encId,
  rows,
  onChange,
}: {
  encId: string;
  rows: DxRow[];
  onChange: (next: DxRow[]) => void;
}) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => searchIcd(q, 8), [q]);

  // Reset highlight whenever the result list changes
  useEffect(() => { setHi(0); }, [q]);

  async function addOne(e: IcdEntry) {
    const optimistic: DxRow = {
      id: `tmp_${e.code}_${Date.now()}`,
      code: e.code,
      display: e.display,
      rank: rows.length === 0 ? 1 : null,
      role: rows.length === 0 ? "principal" : "secondary",
    };
    const next = [...rows, optimistic];
    onChange(next);
    setQ(""); setFocus(false);
    try {
      const r = await ClinicalAPI.addDiagnosis(encId, {
        code: e.code,
        display: e.display,
        rank: optimistic.rank ?? undefined,
        role: optimistic.role ?? undefined,
      });
      const saved = (r as any).data as DxRow;
      onChange(next.map((d) => (d.id === optimistic.id ? saved : d)));
    } catch (err) {
      onChange(rows);
      if (err instanceof ClinicalApiError) toast.error(err.message);
    }
  }

  async function setRole(id: string, role: "principal" | "secondary") {
    const prev = rows;
    const next = rows.map((d) =>
      d.id === id ? { ...d, role, rank: role === "principal" ? 1 : d.rank } : d,
    );
    onChange(next);
    try {
      await ClinicalAPI.updateDiagnosis(id, { role, rank: role === "principal" ? 1 : null });
    } catch (err) {
      onChange(prev);
      if (err instanceof ClinicalApiError) toast.error(err.message);
    }
  }

  async function remove(id: string) {
    const prev = rows;
    onChange(rows.filter((d) => d.id !== id));
    try { await ClinicalAPI.removeDiagnosis(id); }
    catch (err) {
      onChange(prev);
      if (err instanceof ClinicalApiError) toast.error(err.message);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!focus || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); void addOne(hits[hi]); }
    else if (e.key === "Escape") setFocus(false);
  }

  return (
    <div>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
          <Search className="size-4" style={{ color: "var(--clin-muted)" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 120)}
            onKeyDown={onKey}
            placeholder="Search ICD-10-AM by code or text…"
            className="bg-transparent outline-none w-full text-sm"
            style={{ color: "var(--clin-ink)" }}
            aria-autocomplete="list"
          />
        </div>
        {focus && hits.length > 0 && (
          <ul role="listbox" className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-20"
              style={{ background: "#fff", border: "1px solid var(--clin-line-strong)", boxShadow: "var(--shadow)" }}>
            {hits.map((e, i) => (
              <li key={e.code}>
                <button
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => addOne(e)}
                  onMouseEnter={() => setHi(i)}
                  className="w-full text-left px-3 py-2 flex items-center gap-3"
                  style={{ background: i === hi ? "var(--clin-sunken)" : "transparent" }}
                >
                  <span className="mono text-[12px] font-bold" style={{ color: "var(--clin-info)" }}>{e.code}</span>
                  <span className="text-[12.5px] truncate" style={{ color: "var(--clin-ink)" }}>{e.display}</span>
                  <span className="mono text-[10px] ml-auto" style={{ color: "var(--clin-faint)" }}>{e.chapter}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {rows.length === 0 && (
          <span className="text-[12.5px]" style={{ color: "var(--clin-muted)" }}>No diagnoses yet — search above to add one.</span>
        )}
        {rows.map((d) => {
          const principal = d.role === "principal" || d.rank === 1 || d.rank === "1";
          const bg = principal ? "var(--clin-info-tint)" : "var(--clin-warn-tint)";
          const fg = principal ? "var(--clin-info)" : "var(--clin-warn)";
          return (
            <span key={d.id} className="rounded-lg pl-2.5 pr-1 py-1 inline-flex items-center gap-2" style={{ background: bg, color: fg }}>
              <span className="mono font-bold text-[12px]">{d.code}</span>
              <span className="text-[12.5px]">{d.display ?? ""}</span>
              <span className="mono text-[10px] uppercase opacity-70">· {principal ? "PRIMARY" : "SECONDARY"}</span>
              <button
                type="button"
                onClick={() => setRole(d.id, principal ? "secondary" : "principal")}
                className="ml-1 size-5 grid place-items-center rounded hover:bg-white/60"
                aria-label={principal ? "Demote to secondary" : "Promote to primary"}
                title={principal ? "Demote to secondary" : "Promote to primary"}
              >
                {principal ? <ArrowUpDown className="size-3" /> : <Star className="size-3" />}
              </button>
              <button
                type="button"
                onClick={() => remove(d.id)}
                className="size-5 grid place-items-center rounded hover:bg-white/60"
                aria-label="Remove diagnosis"
                title="Remove"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
