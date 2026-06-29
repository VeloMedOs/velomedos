/**
 * Encounter row → FHIR R4 Encounter resource.
 * Pure function. The status here derives from the *clinical* `status` field —
 * NOT `journey_state` (which tracks the MDS/claim pipeline).
 */
import {
  ENCOUNTER_CLASS_DISPLAY,
  ENCOUNTER_CLASS_SYSTEM,
  toFhirEncounterStatus,
} from "./encounter-status";

export type EncounterRow = {
  id: string;
  beneficiary_id: string;
  episode_of_care_id: string | null;
  encounter_number: string;
  class: string;
  type: string | null;
  service_type: string | null;
  priority: string | null;
  status: string;
  journey_state: string;
  period_start: string;
  period_end: string | null;
  reason_text: string | null;
  chief_complaint: string | null;
};

export type EncounterCareTeamRow = {
  practitioner_user_id: string;
  role: string;
  is_primary: boolean | null;
  period_start: string | null;
  period_end: string | null;
};

export type EncounterDiagnosisRow = {
  id: string;
  code_system: string;
  code: string;
  display: string | null;
  role: string;
  rank: number | null;
};

const PARTICIPANT_TYPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/v3-ParticipationType";
const DIAGNOSIS_USE_SYSTEM = "http://terminology.hl7.org/CodeSystem/diagnosis-role";

function participantType(role: string): string {
  switch (role.toLowerCase()) {
    case "attending": return "ATND";
    case "admitting": return "ADM";
    case "consulting": return "CON";
    case "referring": return "REF";
    case "nurse": return "PPRF";
    default: return "PART";
  }
}

function diagnosisUse(role: string): string {
  switch (role.toLowerCase()) {
    case "admission": return "AD";
    case "discharge": return "DD";
    case "principal": return "billing";
    case "secondary": return "CC";
    default: return "post-op";
  }
}

export function encounterToFhirEncounter(
  row: EncounterRow,
  careTeam: EncounterCareTeamRow[],
  diagnoses: EncounterDiagnosisRow[],
  patientRef: string,
): Record<string, unknown> {
  return {
    resourceType: "Encounter",
    id: row.id,
    identifier: [{ value: row.encounter_number }],
    status: toFhirEncounterStatus(row.status),
    class: {
      system: ENCOUNTER_CLASS_SYSTEM,
      code: row.class,
      display: ENCOUNTER_CLASS_DISPLAY[row.class] ?? row.class,
    },
    type: row.type ? [{ text: row.type }] : undefined,
    serviceType: row.service_type ? { text: row.service_type } : undefined,
    priority: row.priority ? { text: row.priority } : undefined,
    subject: { reference: patientRef },
    episodeOfCare: row.episode_of_care_id
      ? [{ reference: `EpisodeOfCare/${row.episode_of_care_id}` }]
      : undefined,
    period: {
      start: row.period_start,
      end: row.period_end ?? undefined,
    },
    reasonCode: row.reason_text || row.chief_complaint
      ? [{ text: row.reason_text ?? row.chief_complaint ?? undefined }]
      : undefined,
    participant: careTeam.length
      ? careTeam.map((ct) => ({
          type: [{
            coding: [{ system: PARTICIPANT_TYPE_SYSTEM, code: participantType(ct.role) }],
            text: ct.role,
          }],
          period: {
            start: ct.period_start ?? undefined,
            end: ct.period_end ?? undefined,
          },
          individual: { reference: `Practitioner/${ct.practitioner_user_id}` },
        }))
      : undefined,
    diagnosis: diagnoses.length
      ? diagnoses.map((d) => ({
          condition: { reference: `Condition/${d.id}`, display: d.display ?? d.code },
          use: { coding: [{ system: DIAGNOSIS_USE_SYSTEM, code: diagnosisUse(d.role) }] },
          rank: d.rank ?? undefined,
        }))
      : undefined,
  };
}