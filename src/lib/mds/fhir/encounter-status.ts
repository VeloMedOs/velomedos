/**
 * Internal encounter clinical status <-> FHIR R4 Encounter.status mapping.
 * NPHIES/FHIR uses hyphenated tokens; the DB stores underscored.
 */
import type { EncounterClinicalStatus } from "../state-machine";

export type FhirEncounterStatus =
  | "planned"
  | "arrived"
  | "triaged"
  | "in-progress"
  | "onleave"
  | "finished"
  | "cancelled"
  | "unknown";

export function toFhirEncounterStatus(s: EncounterClinicalStatus | string | null): FhirEncounterStatus {
  switch (s) {
    case "planned": return "planned";
    case "arrived": return "arrived";
    case "triaged": return "triaged";
    case "in_progress": return "in-progress";
    case "on_leave": return "onleave";
    case "finished": return "finished";
    case "cancelled": return "cancelled";
    default: return "unknown";
  }
}

/** v3 ActCode system URI for Encounter.class. // VERIFY against NPHIES IG */
export const ENCOUNTER_CLASS_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-ActCode";

export const ENCOUNTER_CLASS_DISPLAY: Record<string, string> = {
  AMB: "ambulatory",
  EMER: "emergency",
  IMP: "inpatient encounter",
  HH: "home health",
  VR: "virtual",
};