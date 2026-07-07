/**
 * Daylight · NursingWorkbenchPane (Batch B spine).
 * Reads `/api/clinical/v1/worklists/nursing?class=…`. Vitals-due / assessment-due
 * / eMAR-due / care-plan tasks. eMAR + care-plan are Batch-C literals (0) — the
 * view emits them as stable columns so this pane never breaks.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { worklistsApi, ClinicalApiError, type NursingWorkbenchRow } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { HimCommCard } from "@/components/clinical/daylight/spine/HimCommCard";
import type { EncounterClass } from "./types";

export function NursingWorkbenchPane() {
  const search = useSearch({ from: "/_authenticated/clinical" }) as { class?: string };
  const cls = search.class as EncounterClass | undefined;

  const [rows, setRows] = useState<NursingWorkbenchRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await worklistsApi.nursing(cls ? { class: cls } : undefined);
        if (!cancel) setRows(r.data ?? []);
      } catch (e) {
        if (!cancel) setErr(e instanceof ClinicalApiError ? e.message : "Failed to load");
      }
    })();
    return () => { cancel = true; };
  }, [cls]);

  const totals = useMemo(() => ({
    vitalsDue: rows.reduce((a, r) => a + r.vitals_due, 0),
    assessDue: rows.reduce((a, r) => a + r.assessments_due, 0),
    emar: rows.reduce((a, r) => a + r.emar_due, 0),
    care: rows.reduce((a, r) => a + r.care_tasks_open, 0),
  }), [rows]);

  return (
    <div
      className="px-7 pt-6 pb-14 mx-auto grid gap-4"
      style={{ maxWidth: 1400, width: "100%", gridTemplateColumns: "minmax(0,1fr) 320px" }}
    >
      <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Counter label="Vitals due"    value={totals.vitalsDue} tone="crit" />
        <Counter label="Assess due"    value={totals.assessDue} tone="warn" />
        <Counter label="eMAR due"      value={totals.emar}      tone="info" />
        <Counter label="Care tasks"    value={totals.care} />
      </div>
      <DCard title="Nursing Workbench" caption="v_nursing_workbench · vitals / assessment / eMAR / care-plan">
        {err ? <div className="clin-pill crit">{err}</div> : null}
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
            <tr>
              <th className="text-left py-2">Patient</th>
              <th className="text-left">Class</th>
              <th className="text-left">Last vitals</th>
              <th className="text-left">Due</th>
              <th className="text-left">Assess</th>
              <th className="text-left">eMAR</th>
              <th className="text-left">Care</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.encounter_id} style={{ borderTop: "1px solid var(--hairline)" }}>
                <td className="py-2">
                  <div style={{ color: "var(--clin-ink)", fontWeight: 600 }}>{r.name ?? "—"}</div>
                  <div className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>
                    MRN {r.mrn ?? "—"} · {r.encounter_number ?? r.encounter_id.slice(0, 8)}
                  </div>
                </td>
                <td className="mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{r.class}</td>
                <td className="text-xs" style={{ color: "var(--clin-muted)" }}>
                  {r.latest_vitals_at ? new Date(r.latest_vitals_at).toLocaleTimeString() : "—"}
                </td>
                <td>{r.vitals_due > 0 ? <span className="clin-pill crit">due</span> : <span className="clin-pill ok">ok</span>}</td>
                <td>{r.assessments_due > 0 ? <span className="clin-pill warn">{r.assessments_due}</span> : <span className="clin-pill muted">—</span>}</td>
                <td><span className="clin-pill muted">{r.emar_due}</span></td>
                <td><span className="clin-pill muted">{r.care_tasks_open}</span></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
                No active encounters for this class.
              </td></tr>
            )}
          </tbody>
        </table>
      </DCard>
      </div>
      <aside className="space-y-3">
        <HimCommCard encounterId={rows[0]?.encounter_id ?? null} />
      </aside>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "crit" | "info" }) {
  return (
    <div className="rounded-lg px-3 py-2 min-w-[90px]" style={{ background: "var(--clin-card, #fff)", border: "1px solid var(--hairline)" }}>
      <div className="text-[18px] font-bold" style={{
        color: tone === "ok" ? "var(--clin-ok)"
             : tone === "warn" ? "var(--clin-warn)"
             : tone === "crit" ? "var(--clin-crit)"
             : tone === "info" ? "var(--clin-info, #2563C9)"
             : "var(--clin-ink)",
      }}>{value}</div>
      <div className="text-[10px] mono uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>{label}</div>
    </div>
  );
}