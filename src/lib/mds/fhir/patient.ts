/**
 * Beneficiary row → FHIR R4 Patient resource (KSA-profiled).
 * Pure function, no DB access.
 */
import { identifierSystemFor } from "./identifier-systems";

export type BeneficiaryRow = {
  id: string;
  full_name: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  dob: string;
  gender: string;
  nationality: string | null;
  document_type: string;
  document_id: string;
  contact_number: string | null;
  email: string | null;
  address_line: string | null;
  address_street: string | null;
  address_city: string | null;
  address_district: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  occupation: string | null;
  religion: string | null;
  marital_status: string | null;
  preferred_language: string | null;
  ehealth_id: string | null;
};

const NPHIES_NATIONALITY_EXT = "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-nationality";
const NPHIES_OCCUPATION_EXT = "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-occupation";
const NPHIES_RELIGION_EXT = "http://hl7.org/fhir/StructureDefinition/patient-religion";

function genderForFhir(g: string): "male" | "female" | "other" | "unknown" {
  const v = (g || "").toLowerCase();
  if (v === "male" || v === "m") return "male";
  if (v === "female" || v === "f") return "female";
  if (v === "other") return "other";
  return "unknown";
}

export function beneficiaryToFhirPatient(row: BeneficiaryRow): Record<string, unknown> {
  const identifier = [
    {
      use: "official",
      system: identifierSystemFor(row.document_type),
      value: row.document_id,
    },
  ];
  if (row.ehealth_id) {
    identifier.push({
      use: "secondary",
      system: "http://nphies.sa/identifier/ehealthid",
      value: row.ehealth_id,
    });
  }

  const given = [row.first_name, row.middle_name].filter(Boolean) as string[];
  const name = [
    {
      use: "official",
      text: row.full_name,
      family: row.last_name ?? undefined,
      given: given.length ? given : undefined,
    },
  ];

  const telecom: Array<Record<string, string>> = [];
  if (row.contact_number) telecom.push({ system: "phone", value: row.contact_number, use: "mobile" });
  if (row.email) telecom.push({ system: "email", value: row.email });

  const addressLine = [row.address_line, row.address_street].filter(Boolean) as string[];
  const address =
    addressLine.length || row.address_city || row.address_country
      ? [
          {
            use: "home",
            line: addressLine.length ? addressLine : undefined,
            city: row.address_city ?? undefined,
            district: row.address_district ?? undefined,
            state: row.address_state ?? undefined,
            postalCode: row.address_postal_code ?? undefined,
            country: row.address_country ?? undefined,
          },
        ]
      : undefined;

  const extension: Array<Record<string, unknown>> = [];
  if (row.nationality) {
    extension.push({
      url: NPHIES_NATIONALITY_EXT,
      valueCodeableConcept: { coding: [{ system: "urn:iso:std:iso:3166", code: row.nationality }] },
    });
  }
  if (row.occupation) {
    extension.push({
      url: NPHIES_OCCUPATION_EXT,
      valueCodeableConcept: { text: row.occupation },
    });
  }
  if (row.religion) {
    extension.push({
      url: NPHIES_RELIGION_EXT,
      valueCodeableConcept: { text: row.religion },
    });
  }

  return {
    resourceType: "Patient",
    id: row.id,
    identifier,
    active: true,
    name,
    gender: genderForFhir(row.gender),
    birthDate: row.dob,
    telecom: telecom.length ? telecom : undefined,
    address,
    maritalStatus: row.marital_status ? { text: row.marital_status } : undefined,
    communication: row.preferred_language
      ? [{ language: { text: row.preferred_language }, preferred: true }]
      : undefined,
    extension: extension.length ? extension : undefined,
  };
}
