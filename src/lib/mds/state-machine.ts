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

// ----------------------------------------------------------------------------
// Phase 2 — Encounter clinical lifecycle (FHIR-aligned)
// ----------------------------------------------------------------------------
// This axis is INDEPENDENT of `JourneyState` above. `status` tracks the FHIR
// Encounter.status lifecycle and is driven by /encounters/:id/advance.
// `journey_state` (the Phase-0 machine) tracks the MDS / claim pipeline and is
// driven by later phases (documentation triggers, discharge, coder, grouper,
// claim builder).

export type EncounterClinicalStatus =
  | "planned"
  | "arrived"
  | "triaged"
  | "in_progress"
  | "on_leave"
  | "finished"
  | "cancelled";

export const ENCOUNTER_CLINICAL_TRANSITIONS: Record<EncounterClinicalStatus, EncounterClinicalStatus[]> = {
  planned: ["arrived", "cancelled"],
  arrived: ["triaged", "in_progress", "cancelled"],
  triaged: ["in_progress", "cancelled"],
  in_progress: ["on_leave", "finished"],
  on_leave: ["in_progress", "finished"],
  finished: [],
  cancelled: [],
};

export function canTransitionEncounter(
  from: EncounterClinicalStatus,
  to: EncounterClinicalStatus,
): boolean {
  return (ENCOUNTER_CLINICAL_TRANSITIONS[from] ?? []).includes(to);
}

export class EncounterTransitionError extends Error {
  readonly from: EncounterClinicalStatus;
  readonly to: EncounterClinicalStatus;
  constructor(from: EncounterClinicalStatus, to: EncounterClinicalStatus) {
    super(`Illegal encounter transition: ${from} -> ${to}`);
    this.from = from;
    this.to = to;
    this.name = "EncounterTransitionError";
  }
}

export function assertEncounterTransition(
  from: EncounterClinicalStatus,
  to: EncounterClinicalStatus,
): void {
  if (!canTransitionEncounter(from, to)) {
    throw new EncounterTransitionError(from, to);
  }
}

export const TERMINAL_ENCOUNTER_STATUSES = new Set<EncounterClinicalStatus>(["finished", "cancelled"]);

// ----------------------------------------------------------------------------
// Phase 5 — Monotonic journey-state ranks (mirrors DB encounter_journey_rank).
// ----------------------------------------------------------------------------

export const JOURNEY_RANK: Record<JourneyState, number> = {
  registered: 0,
  encounter_open: 1,
  clinically_documented: 2,
  investigations_ordered: 3,
  admitted: 4,
  discharged: 5,
  coded: 6,
  grouped: 7,
  claim_ready: 8,
  submitted: 9,
  void: -1,
};

/** Returns true only if advancing `from -> to` increases the milestone rank. */
export function canAdvanceJourney(from: JourneyState, to: JourneyState): boolean {
  return JOURNEY_RANK[to] > JOURNEY_RANK[from];
}