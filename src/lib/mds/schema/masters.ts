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
  payer_id: uuid().optional().nullable(),
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
export const ScopeLevel = z.enum(["cash", "payer", "tpa", "policy", "class", "network"]);

const scopeRefine = (v: {
  scope_level: z.infer<typeof ScopeLevel>;
  payer_id?: string | null; tpa_id?: string | null; policy_id?: string | null;
  insurance_class_id?: string | null; network_id?: string | null;
}) => {
  const map: Record<string, string | null | undefined> = {
    cash: null,
    payer: v.payer_id, tpa: v.tpa_id, policy: v.policy_id,
    class: v.insurance_class_id, network: v.network_id,
  };
  const expected = v.scope_level;
  for (const k of ["payer_id","tpa_id","policy_id","insurance_class_id","network_id"] as const) {
    const present = Boolean((v as Record<string, string | null | undefined>)[k]);
    const colKey = k === "insurance_class_id" ? "class" : k.replace("_id","");
    const shouldBeSet = expected === colKey;
    if (present !== shouldBeSet && !(expected === "cash" && !present)) {
      // allow being unset when not the matching scope
      if (shouldBeSet) return false;
      if (present) return false;
    }
  }
  return true;
};

export const PriceListCreate = z.object({
  name: nonEmpty("name"),
  scope_level: ScopeLevel.default("cash"),
  list_type: z.enum(["cash", "payer_network", "cost"]).optional(),
  is_cost_basis: z.boolean().optional(),
  payer_id: uuid().optional().nullable(),
  tpa_id: uuid().optional().nullable(),
  policy_id: uuid().optional().nullable(),
  insurance_class_id: uuid().optional().nullable(),
  network_id: uuid().optional().nullable(),
  parent_price_list_id: uuid().optional().nullable(),
  derive_factor: z.number().positive().optional().nullable(),
  currency: z.string().trim().optional(),
  effective_date: dateStr.optional().nullable(),
  expiry_date: dateStr.optional().nullable(),
  active: z.boolean().optional(),
}).refine(scopeRefine, { message: "Exactly the scope FK matching scope_level must be set" });

export const PriceListUpdate = z.object({
  name: z.string().trim().min(1).optional(),
  scope_level: ScopeLevel.optional(),
  list_type: z.enum(["cash", "payer_network", "cost"]).optional(),
  is_cost_basis: z.boolean().optional(),
  payer_id: uuid().optional().nullable(),
  tpa_id: uuid().optional().nullable(),
  policy_id: uuid().optional().nullable(),
  insurance_class_id: uuid().optional().nullable(),
  network_id: uuid().optional().nullable(),
  parent_price_list_id: uuid().optional().nullable(),
  derive_factor: z.number().positive().optional().nullable(),
  currency: z.string().trim().optional(),
  effective_date: dateStr.optional().nullable(),
  expiry_date: dateStr.optional().nullable(),
  active: z.boolean().optional(),
});

export const PriceListItemCreate = z.object({
  service_id: uuid().optional().nullable(),
  drug_id: uuid().optional().nullable(),
  unit_price_minor: z.number().int().nonnegative(),
  default_factor: z.number().positive().optional(),
  patient_share_percent: z.number().optional().nullable(),
  tax_percent: z.number().optional().nullable(),
  is_package: z.boolean().optional(),
  time_band: z.enum(["am","pm"]).optional().nullable(),
  referral_status: z.enum(["referral","non_referral"]).optional().nullable(),
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
  time_band: z.enum(["am","pm"]).optional().nullable(),
  referral_status: z.enum(["referral","non_referral"]).optional().nullable(),
}).partial();

// ---------- Price list — duplicate / replicate / feed / bulk ----------
export const PriceListDuplicateRequest = z.object({
  name: nonEmpty("name"),
  scope_level: ScopeLevel,
  scope_ref_id: uuid().optional().nullable(),
  factor: z.number().positive().default(1),
});

export const PriceListReplicateRequest = z.object({
  copy_items: z.boolean().default(true),
  targets: z.array(z.object({
    name: z.string().trim().optional(),
    scope_level: ScopeLevel,
    scope_ref_id: uuid().optional().nullable(),
    factor: z.number().positive().default(1),
  })).min(1),
});

export const CatalogFeedRequest = z.object({
  source: z.enum(["service","drug","both"]).default("both"),
  service_type: z.string().trim().optional(),
  category: z.string().trim().optional(),
  code_system: z.enum(["mrid","sfda","gtin","loinc","sbs","achi","atc"]).optional(),
  code_query: z.string().trim().optional(),
  ids: z.array(uuid()).optional(),
  default_unit_price_minor: z.number().int().nonnegative().optional(),
  from_price_list_id: uuid().optional(),
  factor: z.number().positive().default(1),
  limit: z.number().int().positive().max(1000).default(200),
});

export const BulkUpdateRequest = z.object({
  filter: z.object({
    service_type: z.string().optional(),
    category: z.string().optional(),
    code_system: z.enum(["mrid","sfda","gtin","loinc","sbs","achi","atc"]).optional(),
    ids: z.array(uuid()).optional(),
  }).optional(),
  op: z.enum(["pct","amount","set","factor"]),
  value: z.number(),
  effective_date: dateStr.optional().nullable(),
  time_band: z.enum(["am","pm"]).optional().nullable(),
  referral_status: z.enum(["referral","non_referral"]).optional().nullable(),
  change_reason: z.string().trim().optional(),
  dry_run: z.boolean().default(false),
});

export const BulkToggleRequest = z.object({
  ids: z.array(uuid()).optional(),
  filter: z.object({
    service_type: z.string().optional(),
    category: z.string().optional(),
  }).optional(),
});

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