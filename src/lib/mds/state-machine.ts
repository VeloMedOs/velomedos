/**
 * Clinical journey state machine for the Mini-HIS vertical.
 *
 * Phase 0 is intentionally PERMISSIVE — `canTransition` reports whether a
 * transition is well-formed and includes a reason when it would normally be
 * blocked, but always returns `allowed: true`. Strict MDS gates (mandatory
 * vitals, principal diagnosis, EMR class rules) land in Phase 9 and will flip
 * `allowed` to false based on completeness checks supplied by the caller.
 */
import type { ClinicalRole } from "../api-clinical";

export type JourneyState =
  | "registered"
  | "encounter_open"
  | "clinically_documented"
  | "investigations_ordered"
  | "admitted"
  | "discharged"
  | "coded"
  | "grouped"
  | "claim_ready"
  | "submitted"
  | "void";

/**
 * Allowed forward transitions. `void` is reachable from anywhere prior to
 * `submitted`. Inpatient (IMP) journeys flow ...discharged -> coded -> grouped
 * -> claim_ready. Outpatient journeys skip coded/grouped and go straight to
 * claim_ready.
 */
export const TRANSITIONS: Record<JourneyState, JourneyState[]> = {
  registered: ["encounter_open", "void"],
  encounter_open: ["clinically_documented", "void"],
  clinically_documented: ["investigations_ordered", "admitted", "claim_ready", "void"],
  investigations_ordered: ["admitted", "claim_ready", "discharged", "void"],
  admitted: ["discharged", "void"],
  discharged: ["coded", "claim_ready", "void"],
  coded: ["grouped", "void"],
  grouped: ["claim_ready", "void"],
  claim_ready: ["submitted", "void"],
  submitted: [],
  void: [],
};

export type TransitionResult = {
  allowed: boolean;
  reason?: string;
};

export function canTransition(
  from: JourneyState,
  to: JourneyState,
  _role?: ClinicalRole | null,
): TransitionResult {
  const next = TRANSITIONS[from] ?? [];
  if (!next.includes(to)) {
    // Phase 0 permissive: log the gap but allow. Phase 9 will flip allowed to false.
    return { allowed: true, reason: `permissive: ${from} -> ${to} not in transition table` };
  }
  return { allowed: true };
}

export type ReimbursementModel = "drg_bundled" | "itemized_sbs";

/**
 * Map an NPHIES encounter class to a reimbursement model.
 * Inpatient (IMP) is DRG-bundled in KSA; everything else is itemized SBS.
 * Phase 4 pricing and Phase 6 claim assembly branch on this.
 */
export function reimbursementModel(encounterClass: string | null | undefined): ReimbursementModel {
  return (encounterClass ?? "").toUpperCase() === "IMP" ? "drg_bundled" : "itemized_sbs";
}