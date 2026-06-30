/**
 * Map a tenant_members.clinical_role value to the default HIS tab on
 * /clinical so demo / role-based sign-ins land directly on the section
 * that role actually works in.
 */
export type ClinicalTab = "registration" | "encounters" | "coding" | "claims" | "vbhc";

const MAP: Record<string, ClinicalTab> = {
  registrar: "registration",
  physician: "encounters",
  nurse: "encounters",
  case_manager: "encounters",
  tenant_admin: "encounters",
  coder: "coding",
  biller: "claims",
  cashier: "claims",
  rcm: "claims",
  claims_officer: "claims",
  approval_officer: "claims",
  finance: "claims",
  read_only: "encounters",
};

export function tabForClinicalRole(role: string | null | undefined): ClinicalTab {
  if (!role) return "encounters";
  return MAP[role] ?? "encounters";
}

export function clinicalDestinationFor(role: string | null | undefined): string {
  return `/clinical?tab=${tabForClinicalRole(role)}`;
}