/**
 * Daylight · ClinicalFormsWorklistPane (Batch B spine §5A).
 * Central worklist over `v_clinical_forms_worklist` — role-scoped chip filter,
 * gate-type filter, color per §5A.6.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { worklistsApi, ClinicalApiError, type FormsWorklistRow } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";
import type { EncounterClass } from "./types";

type Classification = "all" | "nurse" | "care_team" | "counter" | "specialty";
type Gate = "all" | "pre_order" | "post_order" | "standalone";

function statusTone(row: FormsWorklistRow): "ok" | "warn" | "crit" | "muted" | "info" {
  if (row.status === "cosigned" || row.status === "submitted") return "ok";
  if (row.is_overdue) return "crit";
  if (row.gate_type === "pre_order")  return "crit";
  if (row.gate_type === "post_order") return "warn";
  return "muted";
}

export function ClinicalFormsWorklistPane() {
  const search = useSearch({ from: "/_authenticated/clinical" }) as { class?: string };
  const cls = search.class as EncounterClass | undefined;
  const [rows, setRows] = useState<FormsWorklistRow[]>([]);
  const [classification, setClassification] = useState<Classification>("all");
  const [gate, setGate] = useState<Gate>("all");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await worklistsApi.forms({
          class: cls,
          classification: classification !== "all" ? classification : undefined,
          gate_type: gate !== "all" ? gate : undefined,
        });
        if (!cancel) setRows(r.data ?? []);
      } catch (e) {
        if (!cancel) setErr(e instanceof ClinicalApiError ? e.message : "Failed to load");
      }
    })();
    return () => { cancel = true; };
  }, [cls, classification, gate]);

  const counters = useMemo(() => ({
    total: rows.length,
    overdue: rows.filter((r) => r.is_overdue).length,
    pending: rows.filter((r) => r.status === "pending" || r.status === "in_progress").length,
    done:    rows.filter((r) => r.status === "submitted" || r.status === "cosigned").length,
  }), [rows]);

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1400, width: "100%" }}>
      <div className="flex flex-wrap gap-2 mb-4">
        <Counter label="Instances" value={counters.total} />
        <Counter label="Pending"   value={counters.pending} tone="warn" />
        <Counter label="Overdue"   value={counters.overdue} tone="crit" />
        <Counter label="Done"      value={counters.done}    tone="ok" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <ChipGroup label="Classification" value={classification} onChange={setClassification}
          items={[["all","All"],["nurse","Nurse"],["care_team","Care team"],["counter","Counter"],["specialty","Specialty"]] as const}
        />
        <ChipGroup label="Gate" value={gate} onChange={setGate}
          items={[["all","All"],["pre_order","Pre-order"],["post_order","Post-order"],["standalone","Standalone"]] as const}
        />
      </div>

      <DCard title="Clinical Forms Worklist" caption="v_clinical_forms_worklist · §5A">
        {err ? <div className="clin-pill crit">{err}</div> : null}
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
            <tr>
              <th className="text-left py-2">Form</th>
              <th className="text-left">Class</th>
              <th className="text-left">Gate</th>
              <th className="text-left">Assigned</th>
              <th className="text-left">Status</th>
              <th className="text-left">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.instance_id} style={{ borderTop: "1px solid var(--hairline)" }}>
                <td className="py-2">
                  <div style={{ color: "var(--clin-ink)", fontWeight: 600 }}>{r.title}</div>
                  <div className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>{r.code}</div>
                </td>
                <td className="mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{r.class ?? "—"}</td>
                <td>
                  <span className={`clin-pill ${
                    r.gate_type === "pre_order" ? "crit"
                  : r.gate_type === "post_order" ? "warn"
                  : "muted"}`}>{r.gate_type.replace("_", " ")}</span>
                </td>
                <td className="text-xs" style={{ color: "var(--clin-muted)" }}>{r.assigned_role ?? r.classification ?? "—"}</td>
                <td><span className={`clin-pill ${statusTone(r)}`}>{r.status}{r.is_overdue ? " · overdue" : ""}</span></td>
                <td className="text-xs" style={{ color: "var(--clin-muted)" }}>
                  {r.due_at ? new Date(r.due_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
                No form instances match the filters.
              </td></tr>
            )}
          </tbody>
        </table>
      </DCard>
    </div>
  );
}

function ChipGroup<T extends string>({
  label, items, value, onChange,
}: {
  label: string;
  items: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="mono text-[10px] uppercase tracking-widest mr-1" style={{ color: "var(--clin-muted)" }}>{label}</span>
      {items.map(([id, lbl]) => {
        const on = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="px-2.5 h-6 rounded-full border transition-colors"
            style={{
              borderColor: on ? "var(--teal)" : "var(--hairline)",
              background: on ? "var(--clin-teal-tint)" : "var(--clin-card, #fff)",
              color: on ? "var(--teal)" : "var(--clin-muted)",
              fontWeight: on ? 700 : 600,
            }}
          >{lbl}</button>
        );
      })}
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