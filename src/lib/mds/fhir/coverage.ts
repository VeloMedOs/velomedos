/**
 * Coverage (+ classes) row → FHIR R4 Coverage resource.
 * Pure function, no DB access.
 */
import { NPHIES_PAYER_SYSTEM, NPHIES_TPA_SYSTEM, relationshipCode } from "./identifier-systems";

export type CoverageRow = {
  id: string;
  beneficiary_id: string;
  coverage_type: string;
  member_id: string;
  policy_number: string | null;
  expiry_date: string | null;
  payer_nphies_id: string;
  tpa_nphies_id: string | null;
  relation_with_subscriber: string;
  policy_holder: string;
  status: string;
};

export type CoverageClassRow = {
  id: string;
  coverage_id: string;
  type: "group" | "plan";
  value: string;
  display_name: string | null;
};

export function coverageToFhirCoverage(
  coverage: CoverageRow,
  classes: CoverageClassRow[],
  patientRef: string,
): Record<string, unknown> {
  const payors: Array<Record<string, unknown>> = [
    {
      identifier: { system: NPHIES_PAYER_SYSTEM, value: coverage.payer_nphies_id },
      display: coverage.policy_holder,
    },
  ];
  if (coverage.tpa_nphies_id) {
    payors.push({
      identifier: { system: NPHIES_TPA_SYSTEM, value: coverage.tpa_nphies_id },
    });
  }

  const klass = classes.map((c) => ({
    type: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/coverage-class",
          code: c.type,
        },
      ],
    },
    value: c.value,
    name: c.display_name ?? undefined,
  }));

  return {
    resourceType: "Coverage",
    id: coverage.id,
    status: coverage.status === "active" ? "active" : "cancelled",
    type: { text: coverage.coverage_type },
    subscriberId: coverage.member_id,
    beneficiary: { reference: patientRef },
    relationship: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/subscriber-relationship",
          code: relationshipCode(coverage.relation_with_subscriber),
        },
      ],
    },
    period: coverage.expiry_date ? { end: coverage.expiry_date } : undefined,
    payor: payors,
    class: klass.length ? klass : undefined,
    identifier: coverage.policy_number
      ? [{ system: "http://nphies.sa/identifier/policy", value: coverage.policy_number }]
      : undefined,
  };
}
