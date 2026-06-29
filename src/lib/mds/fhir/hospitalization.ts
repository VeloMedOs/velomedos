/**
 * Phase 5 — FHIR mappers for Encounter.hospitalization and ER extensions.
 * VERIFY against the NPHIES IG before Phase 9 gateway integration.
 */
export type HospitalizationRow = {
  admission_specialty: string | null;
  admission_source: string | null;
  origin: string | null;
  intended_length_of_stay: string | null;
  re_admission: string | null;
  discharge_specialty: string | null;
  discharge_disposition: string | null;
  admitted_at: string | null;
  discharged_at: string | null;
  length_of_stay_days: number | null;
};

export type EmergencyRow = {
  triage_date: string | null;
  triage_category: string | null;
  emergency_arrival_code: string | null;
  emergency_service_start: string | null;
  emergency_department_disposition: string | null;
};

const ADMIT_SOURCE_SYSTEM = "http://terminology.hl7.org/CodeSystem/admit-source";
const DISCHARGE_DISPOSITION_SYSTEM = "http://terminology.hl7.org/CodeSystem/discharge-disposition";
const NPHIES_EXT = "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition";

export function toFhirHospitalization(row: HospitalizationRow): Record<string, unknown> | undefined {
  if (
    !row.admission_source && !row.discharge_disposition && !row.origin &&
    !row.admitted_at && !row.discharged_at
  ) return undefined;
  const hosp: Record<string, unknown> = {};
  if (row.origin) hosp.origin = { display: row.origin };
  if (row.admission_source) {
    hosp.admitSource = {
      coding: [{ system: ADMIT_SOURCE_SYSTEM, code: row.admission_source }],
      text: row.admission_source,
    };
  }
  if (row.discharge_disposition) {
    hosp.dischargeDisposition = {
      coding: [{ system: DISCHARGE_DISPOSITION_SYSTEM, code: row.discharge_disposition }],
      text: row.discharge_disposition,
    };
  }
  const ext: Record<string, unknown>[] = [];
  if (row.admission_specialty) ext.push({ url: `${NPHIES_EXT}/admission-specialty`, valueString: row.admission_specialty });
  if (row.discharge_specialty) ext.push({ url: `${NPHIES_EXT}/discharge-specialty`, valueString: row.discharge_specialty });
  if (row.intended_length_of_stay) ext.push({ url: `${NPHIES_EXT}/intended-length-of-stay`, valueString: row.intended_length_of_stay });
  if (row.re_admission) ext.push({ url: `${NPHIES_EXT}/re-admission`, valueString: row.re_admission });
  if (typeof row.length_of_stay_days === "number") ext.push({ url: `${NPHIES_EXT}/length-of-stay-days`, valueInteger: row.length_of_stay_days });
  if (ext.length) hosp.extension = ext;
  return hosp;
}

export function toFhirEmergencyExtensions(row: EmergencyRow): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (row.triage_category) out.push({ url: `${NPHIES_EXT}/triage-category`, valueString: row.triage_category });
  if (row.triage_date) out.push({ url: `${NPHIES_EXT}/triage-date`, valueDateTime: row.triage_date });
  if (row.emergency_arrival_code) out.push({ url: `${NPHIES_EXT}/emergency-arrival-code`, valueString: row.emergency_arrival_code });
  if (row.emergency_service_start) out.push({ url: `${NPHIES_EXT}/emergency-service-start`, valueDateTime: row.emergency_service_start });
  if (row.emergency_department_disposition) out.push({ url: `${NPHIES_EXT}/ed-disposition`, valueString: row.emergency_department_disposition });
  return out;
}