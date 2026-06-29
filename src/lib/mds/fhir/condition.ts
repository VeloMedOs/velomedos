/**
 * Diagnosis row → FHIR R4 Condition resource.
 * // VERIFY all system URIs against the current NPHIES IG.
 */
export type DiagnosisRow = {
  id: string;
  code_system: string;
  code: string;
  display: string | null;
  role: string;
  present_on_admission: string | null;
  is_chronic: boolean | null;
  onset_date: string | null;
};

export const CODE_SYSTEM_URI: Record<string, string> = {
  "icd-10-am": "http://hl7.org/fhir/sid/icd-10-am",
  "icd-10": "http://hl7.org/fhir/sid/icd-10",
  achi: "http://hl7.org/fhir/sid/achi",
  sbs: "http://nphies.sa/terminology/CodeSystem/sbs",
  "ar-drg": "http://nphies.sa/terminology/CodeSystem/ar-drg",
  loinc: "http://loinc.org",
  snomed: "http://snomed.info/sct",
};

const POA_EXT = "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-present-on-admission";

export function diagnosisToFhirCondition(
  row: DiagnosisRow,
  patientRef: string,
  encounterRef: string,
): Record<string, unknown> {
  const system = CODE_SYSTEM_URI[(row.code_system || "").toLowerCase()] ?? row.code_system;
  const extension: Array<Record<string, unknown>> = [];
  if (row.present_on_admission) {
    extension.push({ url: POA_EXT, valueCode: row.present_on_admission });
  }
  return {
    resourceType: "Condition",
    id: row.id,
    clinicalStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
        code: row.is_chronic ? "active" : "active",
      }],
    },
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-category",
        code: "encounter-diagnosis",
      }],
    }],
    code: {
      coding: [{ system, code: row.code, display: row.display ?? undefined }],
      text: row.display ?? row.code,
    },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    onsetDateTime: row.onset_date ?? undefined,
    extension: extension.length ? extension : undefined,
  };
}