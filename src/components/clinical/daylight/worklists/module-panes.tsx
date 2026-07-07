/**
 * The 10 module worklist panes (Turn 2b). Each is a thin wrapper over
 * ModuleWorklistPane bound to its route + FormsMiniCard classification.
 */
import { worklistsApi, type FormsWorklistRow } from "@/lib/clinical-api";
import { ModuleWorklistPane } from "./ModuleWorklistPane";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { useEffect, useState } from "react";
import { ClinicalApiError } from "@/lib/clinical-api";

export const EmsPane = () => (
  <ModuleWorklistPane title="Ambulance / EMS" caption="v_doctor_worklist · class=EMER" fetcher={worklistsApi.ems} classification="care_team" showClassFilter={false} />
);
export const FrontOfficePane = () => (
  <ModuleWorklistPane title="Front Office" caption="registered / encounter_open" fetcher={worklistsApi.frontOffice} classification="counter" />
);
export const AdmissionPane = () => (
  <ModuleWorklistPane title="Admission" caption="IMP · pre-admission" fetcher={worklistsApi.admission} classification="nurse" showClassFilter={false} />
);
export const FloorManagerPane = () => (
  <ModuleWorklistPane title="Floor Manager" caption="IMP · admitted" fetcher={worklistsApi.floorManager} classification="nurse" showClassFilter={false} />
);
export const TransferDischargePane = () => (
  <ModuleWorklistPane title="Transfer / Discharge" caption="IMP · admitted or discharged" fetcher={worklistsApi.transferDischarge} classification="nurse" showClassFilter={false} />
);
export const CoderPane = () => (
  <ModuleWorklistPane title="Coder" caption="finished · discharged · awaiting coding" fetcher={worklistsApi.coder} classification={null} showClassFilter={false} />
);
export const PharmacistPane = () => (
  <ModuleWorklistPane title="Pharmacist" caption="prescription pressure" fetcher={worklistsApi.pharmacist} classification="care_team" />
);
export const NutritionPane = () => (
  <ModuleWorklistPane title="Nutrition" caption="specialty forms open" fetcher={worklistsApi.nutrition} classification="specialty" />
);
export const SocialWorkPane = () => (
  <ModuleWorklistPane title="Social Work" caption="IMP/EMER · specialty forms open" fetcher={worklistsApi.socialWork} classification="specialty" />
);

/** MRD pane reads v_clinical_forms_worklist directly (cosign backlog). */
export function MrdPane() {
  const [rows, setRows] = useState<FormsWorklistRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await worklistsApi.mrd();
        if (!cancel) setRows(r.data ?? []);
      } catch (e) {
        if (!cancel) setErr(e instanceof ClinicalApiError ? e.message : "Failed to load");
      }
    })();
    return () => { cancel = true; };
  }, []);
  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1400, width: "100%" }}>
      <DCard title="Medical Records · Cosign backlog" caption="overdue OR (submitted AND cosign_required AND !cosigned_at)">
        {err ? <div className="clin-pill crit">{err}</div> : null}
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
            <tr>
              <th className="text-left py-2">Form</th>
              <th className="text-left">Class</th>
              <th className="text-left">Assigned</th>
              <th className="text-left">Status</th>
              <th className="text-left">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.instance_id} style={{ borderTop: "1px solid var(--hairline)" }}>
                <td className="py-2"><div style={{ fontWeight: 600 }}>{r.title}</div><div className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>{r.code}</div></td>
                <td className="mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{r.class ?? "—"}</td>
                <td className="text-xs" style={{ color: "var(--clin-muted)" }}>{r.assigned_role ?? "—"}</td>
                <td><span className={`clin-pill ${r.status === "submitted" ? "warn" : "muted"}`}>{r.status}</span></td>
                <td>{r.is_overdue ? <span className="clin-pill crit">{r.overdue_days ?? 0}d</span> : (r.cosign_required && !r.cosigned_at ? <span className="clin-pill warn">cosign</span> : <span className="clin-pill muted">—</span>)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={5} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>Cosign queue clear.</td></tr>
            )}
          </tbody>
        </table>
      </DCard>
    </div>
  );
}