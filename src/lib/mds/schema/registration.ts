/**
 * Zod schemas for Phase 1 — Registration MDS.
 * Permissive: only the NPHIES core fields are required. Phase 10 hardens.
 */
import { z } from "zod";

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);

export const BeneficiaryCreate = z.object({
  patient_file_no: z.string().trim().optional().nullable(),
  first_name: z.string().trim().optional().nullable(),
  middle_name: z.string().trim().optional().nullable(),
  last_name: z.string().trim().optional().nullable(),
  full_name: nonEmpty("full_name"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dob must be YYYY-MM-DD"),
  gender: nonEmpty("gender"),
  nationality: z.string().trim().optional().nullable(),
  document_type: nonEmpty("document_type"),
  document_id: nonEmpty("document_id"),
  contact_number: z.string().trim().optional().nullable(),
  ehealth_id: z.string().trim().optional().nullable(),
  residency_type: z.string().trim().optional().nullable(),
  marital_status: z.string().trim().optional().nullable(),
  blood_group: z.string().trim().optional().nullable(),
  preferred_language: z.string().trim().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address_line: z.string().trim().optional().nullable(),
  address_street: z.string().trim().optional().nullable(),
  address_city: z.string().trim().optional().nullable(),
  address_district: z.string().trim().optional().nullable(),
  address_state: z.string().trim().optional().nullable(),
  address_postal_code: z.string().trim().optional().nullable(),
  address_country: z.string().trim().optional().nullable(),
  occupation: z.string().trim().optional().nullable(),
  religion: z.string().trim().optional().nullable(),
  birth_weight_grams: z.number().int().positive().optional().nullable(),
  patient_user_id: z.string().uuid().optional().nullable(),
});
export type BeneficiaryCreateInput = z.infer<typeof BeneficiaryCreate>;

export const BeneficiaryUpdate = BeneficiaryCreate.partial();
export type BeneficiaryUpdateInput = z.infer<typeof BeneficiaryUpdate>;

export const CoverageClassCreate = z.object({
  type: z.enum(["group", "plan"]),
  value: nonEmpty("value"),
  display_name: z.string().trim().optional().nullable(),
});
export type CoverageClassCreateInput = z.infer<typeof CoverageClassCreate>;

export const CoverageCreate = z.object({
  coverage_type: nonEmpty("coverage_type"),
  member_id: nonEmpty("member_id"),
  policy_number: z.string().trim().optional().nullable(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  payer_nphies_id: nonEmpty("payer_nphies_id"),
  tpa_nphies_id: z.string().trim().optional().nullable(),
  relation_with_subscriber: nonEmpty("relation_with_subscriber"),
  policy_holder: nonEmpty("policy_holder"),
  status: z.enum(["active", "cancelled", "suspended"]).optional(),
  classes: z.array(CoverageClassCreate).optional(),
});
export type CoverageCreateInput = z.infer<typeof CoverageCreate>;

export const CoverageUpdate = z.object({
  coverage_type: z.string().trim().min(1).optional(),
  member_id: z.string().trim().min(1).optional(),
  policy_number: z.string().trim().optional().nullable(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  payer_nphies_id: z.string().trim().min(1).optional(),
  tpa_nphies_id: z.string().trim().optional().nullable(),
  relation_with_subscriber: z.string().trim().min(1).optional(),
  policy_holder: z.string().trim().min(1).optional(),
  status: z.enum(["active", "cancelled", "suspended"]).optional(),
}).partial();
export type CoverageUpdateInput = z.infer<typeof CoverageUpdate>;
