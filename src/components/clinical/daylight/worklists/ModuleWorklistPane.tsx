/**
 * Shared thin wrapper for the 10 module worklist panes (Turn 2b). Copies the
 * DoctorWorklistPane row shape without duplicating the JSX 10 times. Each
 * caller supplies a fetcher, a title, and the FormsMiniCard classification.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { ClinicalApiError, type DoctorWorklistRow, type FormClassification } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { UrgencyChips, formatWait, waitTone, type Urgency } from "./WorklistFilters";
import { urgencyMatches } from "./module-filters";
import { FormsMiniCard } from "./FormsMiniCard";
import type { EncounterClass } from "./types";

export type ModuleFetcher = (params?: { class?: EncounterClass }) => Promise<{ data: DoctorWorklistRow[] }>;

export function ModuleWorklistPane({
  title, caption, fetcher, classification, showClassFilter = true,
}: {
  title: string;
  caption: string;
  fetcher: ModuleFetcher;
  /** null hides the FormsMiniCard rail (Coder, MRD use the central Forms WL). */
  classification: FormClassification | null;
  showClassFilter?: boolean;
}) {
  const search = useSearch({ from: "/_authenticated/clinical" }) as { class?: string };
  const cls = search.class as EncounterClass | undefined;
  const [rows, setRows] = useState<DoctorWorklistRow[]>([]);
  const [urgency, setUrgency] = useState<Urgency>("all");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await fetcher(cls && showClassFilter ? { class: cls } : undefined);
        if (!cancel) setRows(r.data ?? []);
      } catch (e) {
        if (!cancel) setErr(e instanceof ClinicalApiError ? e.message : "Failed to load");
      }
    })();
    return () => { cancel = true; };
  }, [cls, fetcher, showClassFilter]);

  const filtered = useMemo(() => rows.filter((r) => urgencyMatches(r, urgency)), [rows, urgency]);
  const firstEnc = filtered[0]?.encounter_id ?? null;

  return (
    <div
      className="px-7 pt-6 pb-14 mx-auto grid gap-4"
      style={{ maxWidth: 1400, width: "100%", gridTemplateColumns: "minmax(0,1fr) 320px" }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <UrgencyChips value={urgency} onChange={setUrgency} />
        </div>
        <DCard title={title} caption={caption}>
          {err ? <div className="clin-pill crit">{err}</div> : null}
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
              <tr>
                <th className="text-left py-2">Patient</th>
                <th className="text-left">Class</th>
                <th className="text-left">Journey</th>
                <th className="text-left">Waiting</th>
                <th className="text-left">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.encounter_id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td className="py-2">
                    <div style={{ color: "var(--clin-ink)", fontWeight: 600 }}>
                      {r.name ?? "—"}{r.age != null && r.gender ? ` · ${r.age}${r.gender.charAt(0).toUpperCase()}` : ""}
                      {r.is_vip ? <span className="clin-pill info ml-1">VIP</span> : null}
                    </div>
                    <div className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>
                      MRN {r.mrn ?? "—"} · {r.encounter_number ?? r.encounter_id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{r.class}</td>
                  <td className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>{r.journey_state}</td>
                  <td>
                    <span className={`clin-pill ${waitTone(r.waiting_seconds)}`}>{formatWait(r.waiting_seconds)}</span>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {r.dnr_flag ? <span className="clin-pill crit">DNR</span> : null}
                      {r.isolation_precaution ? <span className="clin-pill warn">{r.isolation_precaution}</span> : null}
                      {r.discharge_disposition ? <span className="clin-pill muted">{r.discharge_disposition}</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={5} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
                  No encounters.
                </td></tr>
              )}
            </tbody>
          </table>
        </DCard>
      </div>
      <aside className="space-y-3">
        {classification && firstEnc ? (
          <FormsMiniCard encounterId={firstEnc} classification={classification} />
        ) : null}
      </aside>
    </div>
  );
}