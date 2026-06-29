/**
 * Zod schemas for Phase 3 — Master Data.
 * Permissive: minimal required fields only; Phase 10 tightens.
 */
import { z } from "zod";

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const uuid = () => z.string().uuid();

// ---------- Payer ----------
export const PayerCreate = z.object({
  nphies_payer_id: nonEmpty("nphies_payer_id"),
  name: nonEmpty("name"),
  payer_type: z.enum(["public", "private"]).optional(),
  active: z.boolean().optional(),
});
export const PayerUpdate = PayerCreate.partial();

// ---------- TPA (no payer_id — many-to-many) ----------
export const TpaCreate = z.object({
  nphies_tpa_id: nonEmpty("nphies_tpa_id"),
  name: nonEmpty("name"),
  active: z.boolean().optional(),
});
export const TpaUpdate = TpaCreate.partial();

// ---------- Policy ----------
export const PolicyCreate = z.object({
  payer_id: uuid(),
  policy_number: nonEmpty("policy_number"),
  name: z.string().trim().optional().nullable(),
  effective_date: dateStr.optional().nullable(),
  expiry_date: dateStr.optional().nullable(),
  active: z.boolean().optional(),
});
export const PolicyUpdate = PolicyCreate.partial();

// ---------- Insurance class ----------
export const InsuranceClassCreate = z.object({
  policy_id: uuid(),
  code: nonEmpty("code"),
  name: z.string().trim().optional().nullable(),
});
export const InsuranceClassUpdate = InsuranceClassCreate.partial();

// ---------- Insurance plan ----------
export const InsurancePlanCreate = z.object({
  class_id: uuid(),
  code: nonEmpty("code"),
  name: z.string().trim().optional().nullable(),
  copay_percent: z.number().optional().nullable(),
  deductible_minor: z.number().int().nonnegative().optional().nullable(),
  annual_limit_minor: z.number().int().nonnegative().optional().nullable(),
});
export const InsurancePlanUpdate = InsurancePlanCreate.partial();

// ---------- Network ----------
export const NetworkCreate = z.object({
  payer_id: uuid(),
  name: nonEmpty("name"),
  tier: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});
export const NetworkUpdate = NetworkCreate.partial();

// ---------- Network membership ----------
export const NetworkMembershipCreate = z.object({
  provider_facility_id: uuid(),
  in_network: z.boolean().optional(),
});
export const NetworkMembershipUpdate = z.object({
  in_network: z.boolean().optional(),
}).partial();

// ---------- Service master ----------
export const ServiceType = z.enum([
  "laboratory", "imaging", "procedures", "services",
  "medical-devices", "oral-health-ip", "oral-health-op", "transportation-srca",
]);
export const ServiceMasterCreate = z.object({
  internal_code: nonEmpty("internal_code"),
  name: nonEmpty("name"),
  description: z.string().trim().optional().nullable(),
  service_type: ServiceType,
  modality: z.string().trim().optional().nullable(),
  is_package: z.boolean().optional(),
  body_site: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});
export const ServiceMasterUpdate = ServiceMasterCreate.partial();

export const ServiceCodeCreate = z.object({
  code_system_id: uuid(),
  code: nonEmpty("code"),
  display: z.string().trim().optional().nullable(),
  is_primary_billing: z.boolean().optional(),
});
export const ServiceCodeUpdate = ServiceCodeCreate.partial();

// ---------- Drug master ----------
export const DrugMasterCreate = z.object({
  internal_code: nonEmpty("internal_code"),
  generic_name: nonEmpty("generic_name"),
  trade_name: z.string().trim().optional().nullable(),
  form: z.string().trim().optional().nullable(),
  strength: z.string().trim().optional().nullable(),
  route: z.string().trim().optional().nullable(),
  gtin: z.string().trim().optional().nullable(),
  mrid: z.string().trim().optional().nullable(),
  sfda_sci_code: z.string().trim().optional().nullable(),
  atc_code: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});
export const DrugMasterUpdate = DrugMasterCreate.partial();

// ---------- Price list ----------
export const PriceListCreate = z.object({
  name: nonEmpty("name"),
  list_type: z.enum(["cash", "payer_network", "cost"]),
  payer_id: uuid().optional().nullable(),
  network_id: uuid().optional().nullable(),
  currency: z.string().trim().optional(),
  effective_date: dateStr.optional().nullable(),
  expiry_date: dateStr.optional().nullable(),
  active: z.boolean().optional(),
}).refine(
  (v) => v.list_type !== "payer_network" || Boolean(v.payer_id),
  { message: "payer_id is required for payer_network lists" },
);
export const PriceListUpdate = z.object({
  name: z.string().trim().min(1).optional(),
  list_type: z.enum(["cash", "payer_network", "cost"]).optional(),
  payer_id: uuid().optional().nullable(),
  network_id: uuid().optional().nullable(),
  currency: z.string().trim().optional(),
  effective_date: dateStr.optional().nullable(),
  expiry_date: dateStr.optional().nullable(),
  active: z.boolean().optional(),
}).partial();

export const PriceListItemCreate = z.object({
  service_id: uuid().optional().nullable(),
  drug_id: uuid().optional().nullable(),
  unit_price_minor: z.number().int().nonnegative(),
  default_factor: z.number().positive().optional(),
  patient_share_percent: z.number().optional().nullable(),
  tax_percent: z.number().optional().nullable(),
  is_package: z.boolean().optional(),
}).refine(
  (v) => Boolean(v.service_id) !== Boolean(v.drug_id),
  { message: "Exactly one of service_id or drug_id must be set" },
);
export const PriceListItemUpdate = z.object({
  unit_price_minor: z.number().int().nonnegative().optional(),
  default_factor: z.number().positive().optional(),
  patient_share_percent: z.number().optional().nullable(),
  tax_percent: z.number().optional().nullable(),
  is_package: z.boolean().optional(),
}).partial();

// ---------- DRG (reference) ----------
export const DrgCreate = z.object({
  code_system_id: uuid(),
  drg_code: nonEmpty("drg_code"),
  drg_name: z.string().trim().optional().nullable(),
  mdc: z.string().trim().optional().nullable(),
  adrg: z.string().trim().optional().nullable(),
  partition: z.enum(["medical", "intervention"]).optional().nullable(),
  version: nonEmpty("version"),
  relative_weight: z.number(),
  low_trim_los: z.number().int().optional().nullable(),
  high_trim_los: z.number().int().optional().nullable(),
  avg_los: z.number().optional().nullable(),
  active: z.boolean().optional(),
});
export const DrgUpdate = DrgCreate.partial();

// ---------- DRG base rate ----------
export const DrgBaseRateCreate = z.object({
  payer_id: uuid(),
  network_id: uuid().optional().nullable(),
  drg_version: nonEmpty("drg_version"),
  base_rate_minor: z.number().int().nonnegative(),
  currency: z.string().trim().optional(),
  effective_from: dateStr.optional().nullable(),
  effective_to: dateStr.optional().nullable(),
});
export const DrgBaseRateUpdate = DrgBaseRateCreate.partial();

// ---------- DRG price adjustment ----------
export const DrgPriceAdjustmentCreate = z.object({
  payer_id: uuid().optional().nullable(),
  drg_version: z.string().trim().optional().nullable(),
  adj_type: z.enum(["high_outlier", "low_outlier", "short_stay", "icu_addon", "sameday", "transfer"]),
  trim_basis: z.enum(["los", "cost"]).optional().nullable(),
  per_diem_minor: z.number().int().optional().nullable(),
  marginal_rate: z.number().optional().nullable(),
  threshold: z.number().optional().nullable(),
  formula: z.record(z.string(), z.unknown()).optional().nullable(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
});
export const DrgPriceAdjustmentUpdate = DrgPriceAdjustmentCreate.partial();