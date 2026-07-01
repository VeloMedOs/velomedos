/**
 * Map a tenant_members.clinical_role value to the default Daylight tab on
 * /clinical so demo / role-based sign-ins land directly on the worklist that
 * role actually works in. Extended for RCM/Finance panes (Chunk R1 nav).
 */
import type { NavTabId } from "@/components/clinical/daylight/nav-config";

export type ClinicalTab = NavTabId;

const MAP: Record<string, ClinicalTab> = {
  registrar:        "registration",
  front_office:     "registration",
  physician:        "encounters",
  nurse:            "encounters",
  lab_tech:         "encounters",
  radiologist:      "encounters",
  pharmacist:       "encounters",
  case_manager:     "encounters",
  tenant_admin:     "admin-masters",
  coder:            "coding",
  biller:           "finance-billing-op",
  cashier:          "finance-billing-op",
  rcm:              "rcm",
  claims_officer:   "rcm-claims",
  approval_officer: "rcm-authorization",
  finance:          "finance-deposits",
  read_only:        "encounters",
};

export function tabForClinicalRole(role: string | null | undefined): ClinicalTab {
  if (!role) return "encounters";
  return MAP[role] ?? "encounters";
}

export function clinicalDestinationFor(role: string | null | undefined): string {
  return `/clinical?tab=${tabForClinicalRole(role)}`;
}