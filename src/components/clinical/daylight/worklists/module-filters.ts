/**
 * Shared filter primitives for the 10 module worklist panes (Turn 2b).
 * Kept as pure functions so unit tests can hit them without JSX or fetch.
 */
import type { DoctorWorklistRow, FormsWorklistRow } from "@/lib/clinical-api";

export type Urgency = "all" | "stat" | "urgent" | "routine";

export function urgencyMatches(row: DoctorWorklistRow, urgency: Urgency): boolean {
  const w = row.waiting_seconds ?? 0;
  if (urgency === "all") return true;
  if (urgency === "stat") return w >= 60 * 60;
  if (urgency === "urgent") return w >= 30 * 60 && w < 60 * 60;
  return w < 30 * 60; // routine
}

/** Coder module — only rows with matching journey_state='discharged' + status='finished'. */
export function coderFilter(rows: DoctorWorklistRow[]): DoctorWorklistRow[] {
  return rows.filter((r) => r.status === "finished" && r.journey_state === "discharged");
}

/** MRD cosign backlog. Row-level detection kept for parity with the SQL filter. */
export function mrdCosignFilter(rows: FormsWorklistRow[]): FormsWorklistRow[] {
  return rows.filter((r) =>
    r.is_overdue
    || (r.status === "submitted" && r.cosign_required === true && !r.cosigned_at),
  );
}

/** Front-office: only registered/encounter_open journey states. */
export function frontOfficeFilter(rows: DoctorWorklistRow[]): DoctorWorklistRow[] {
  return rows.filter((r) => r.journey_state === "registered" || r.journey_state === "encounter_open");
}

/** Admission: IMP-class pre-admission. */
export function admissionFilter(rows: DoctorWorklistRow[]): DoctorWorklistRow[] {
  const pre = new Set(["registered", "encounter_open", "clinically_documented", "investigations_ordered"]);
  return rows.filter((r) => r.class === "IMP" && pre.has(r.journey_state));
}

/** Floor manager: admitted IMP encounters. */
export function floorManagerFilter(rows: DoctorWorklistRow[]): DoctorWorklistRow[] {
  return rows.filter((r) => r.class === "IMP" && r.journey_state === "admitted");
}

/** Transfer/discharge: IMP admitted or discharged. */
export function transferDischargeFilter(rows: DoctorWorklistRow[]): DoctorWorklistRow[] {
  return rows.filter((r) => r.class === "IMP" && (r.journey_state === "admitted" || r.journey_state === "discharged"));
}

/** EMS: EMER-class encounters. */
export function emsFilter(rows: DoctorWorklistRow[]): DoctorWorklistRow[] {
  return rows.filter((r) => r.class === "EMER");
}

/** Pharmacist: rows with prescription pressure. */
export function pharmacistFilter(rows: DoctorWorklistRow[]): DoctorWorklistRow[] {
  return rows.filter((r) =>
    (r.released_orders ?? 0) > 0
    || (r.locked_orders ?? 0) > 0
    || (r.pending_authorizations ?? 0) > 0,
  );
}