/**
 * clinical_supporting_info rows → NPHIES SupportingInfo entries.
 * Internal underscored enum -> hyphenated NPHIES tokens. // VERIFY against IG.
 */
export type SupportingInfoRow = {
  id: string;
  category: string;
  value_text: string | null;
  value_code: string | null;
  code_system: string | null;
  value_attachment_url: string | null;
  recorded_at: string;
  sequence: number | null;
};

export const SUPPORTING_INFO_CATEGORY_NPHIES: Record<string, string> = {
  history_of_present_illness: "history-of-present-illness",
  physical_examination: "physical-examination",
  treatment_plan: "treatment-plan",
  patient_history: "patient-history",
  investigation_result: "investigation-result",
  other: "info",
};

const CATEGORY_SYSTEM = "http://nphies.sa/terminology/CodeSystem/claim-information-category";

export function categoryToNphies(internal: string): string {
  return SUPPORTING_INFO_CATEGORY_NPHIES[internal] ?? "info";
}

export function supportingInfoToFhir(
  rows: SupportingInfoRow[],
  patientRef: string,
  encounterRef: string,
): Array<Record<string, unknown>> {
  return rows.map((r, idx) => ({
    resourceType: r.category === "investigation_result" ? "Observation" : "DocumentReference",
    id: r.id,
    status: "current",
    sequence: r.sequence ?? idx + 1,
    category: [{
      coding: [{ system: CATEGORY_SYSTEM, code: categoryToNphies(r.category) }],
      text: r.category,
    }],
    subject: { reference: patientRef },
    context: { encounter: [{ reference: encounterRef }] },
    date: r.recorded_at,
    description: r.value_text ?? undefined,
    code: r.value_code
      ? { coding: [{ system: r.code_system ?? "urn:unspecified", code: r.value_code }] }
      : undefined,
    content: r.value_attachment_url
      ? [{ attachment: { url: r.value_attachment_url } }]
      : undefined,
  }));
}