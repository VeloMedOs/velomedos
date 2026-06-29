/**
 * RCM Phase R1 — Zod schemas for contract enrichment + eligibility lifecycle.
 * Permissive (Phase-10 tightens via the readiness validator).
 */
import { z } from "zod";

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const uuid = () => z.string().uuid();

// --- payer_agreement ---
export const PayerAgreementCreate = z.object({
  payer_id: uuid(),
  tpa_id: uuid().optional().nullable(),
  agreement_no: nonEmpty("agreement_no"),
  contract_start: dateStr,
  contract_end: dateStr.optional().nullable(),
  settlement_terms_days: z.number().int().positive().optional(),
  prompt_payment_discount_percent: z.number().optional().nullable(),
  volume_discount_rules: z.record(z.string(), z.unknown()).optional().nullable(),
  vat_treatment: z.enum(["standard", "exempt", "zero_rated"]).optional(),
  active: z.boolean().optional(),
});
export const PayerAgreementUpdate = PayerAgreementCreate.partial();

// --- coverage / approval rule masters ---
const RuleScope = z.enum([
  "specialty", "clinical_condition", "icd10", "approval_limit",
  "payer", "class_exclusion", "sub_category", "service_item",
]);
const RuleBase = z.object({
  payer_id: uuid().optional().nullable(),
  policy_id: uuid().optional().nullable(),
  class_id: uuid().optional().nullable(),
  scope: RuleScope,
  condition: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});
export const NotCoveredRuleCreate = RuleBase;
export const NotCoveredRuleUpdate = RuleBase.partial();
export const NeedApprovalRuleCreate = RuleBase;
export const NeedApprovalRuleUpdate = RuleBase.partial();

// --- maternity protocol ---
export const MaternityProtocolCreate = z.object({
  payer_id: uuid().optional().nullable(),
  policy_id: uuid().optional().nullable(),
  name: nonEmpty("name"),
  rules: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});
export const MaternityProtocolUpdate = MaternityProtocolCreate.partial();

// --- contract change request (governed audit-controlled updates) ---
export const ContractChangeRequestCreate = z.object({
  target_table: z.enum([
    "payer", "tpa", "policy", "insurance_class", "insurance_plan",
    "network", "payer_agreement", "price_list", "price_list_item",
  ]),
  target_id: uuid(),
  before: z.record(z.string(), z.unknown()).optional().nullable(),
  after: z.record(z.string(), z.unknown()),
  effective_date: dateStr.optional().nullable(),
  reason: z.string().trim().optional().nullable(),
});
export const ContractChangeRequestUpdate = ContractChangeRequestCreate.partial();

// --- eligibility ---
export const EligibilityCheckRequest = z.object({
  encounter_id: uuid().optional().nullable(),
  beneficiary_id: uuid(),
  coverage_id: uuid().optional().nullable(),
});
export const EligibilityExceptionCreate = z.object({
  exception_type: z.enum(["referral", "emergency", "newborn"]),
  referral_letter_url: z.string().url().optional().nullable(),
  referral_ref_no: z.string().trim().optional().nullable(),
  referred_provider: z.string().trim().optional().nullable(),
  referral_date: dateStr.optional().nullable(),
  ctas_level: z.number().int().min(1).max(5).optional().nullable(),
  birth_certificate_url: z.string().url().optional().nullable(),
  mother_membership_no: z.string().trim().optional().nullable(),
  mother_coverage_id: uuid().optional().nullable(),
  validity_from: dateStr.optional().nullable(),
  validity_to: dateStr.optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const EligibilityTransitionRequest = z.object({
  event: z.enum([
    "exception.approve", "exception.reject",
    "activation.request", "activation.complete", "activation.reject",
    "select.self_pay", "cancel",
  ]),
  reason: z.string().trim().optional().nullable(),
});

// --- policy activation worklist ---
export const PolicyActivationCreate = z.object({
  visit_eligibility_id: uuid(),
  payer_id: uuid().optional().nullable(),
  policy_no: z.string().trim().optional().nullable(),
  class_code: z.string().trim().optional().nullable(),
  membership_no: z.string().trim().optional().nullable(),
  is_ineligible_flag: z.boolean().optional(),
  validity_from: dateStr.optional().nullable(),
  validity_to: dateStr.optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
export const PolicyActivationUpdate = PolicyActivationCreate.partial().extend({
  status: z.enum(["pending", "in_progress", "activated", "rejected"]).optional(),
  assigned_to: uuid().optional().nullable(),
});