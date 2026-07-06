/**
 * Zod schemas for Phase 4 — Orders, Charges, Pricing Rules.
 * Permissive: minimal required fields only; Phase 10 tightens.
 */
import { z } from "zod";

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const uuid = () => z.string().uuid();

// ---------- Shared order-header bits ----------
const HeaderBase = {
  priority: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  ordered_by: uuid().optional().nullable(),
  preauth_required: z.boolean().optional(),
  preauth_ref: z.string().trim().optional().nullable(),
  preauth_status: z.enum(["not_required", "pending", "approved", "rejected"]).optional().nullable(),
};
const StatusUpdate = {
  status: z.enum(["ordered", "in_progress", "completed", "cancelled"]).optional(),
  ...HeaderBase,
};

// ---------- Lab ----------
export const LabItemCreate = z.object({
  service_id: uuid().optional().nullable(),
  loinc_code: z.string().trim().optional().nullable(),
  specimen: z.string().trim().optional().nullable(),
  quantity: z.number().positive().optional(),
});
export const LabItemUpdate = z.object({
  result_value: z.string().optional().nullable(),
  result_unit: z.string().optional().nullable(),
  result_status: z.string().optional().nullable(),
  result_at: z.string().datetime().optional().nullable(),
  status: z.enum(["ordered", "collected", "in_progress", "resulted", "cancelled"]).optional(),
}).partial();
export const LabOrderCreate = z.object({
  ...HeaderBase,
  items: z.array(LabItemCreate).min(1, "at least one item required"),
});
export const LabOrderUpdate = z.object(StatusUpdate).partial();

// ---------- Radiology ----------
export const RadiologyItemCreate = z.object({
  service_id: uuid().optional().nullable(),
  modality: z.string().trim().optional().nullable(),
  body_site: z.string().trim().optional().nullable(),
  quantity: z.number().positive().optional(),
});
export const RadiologyItemUpdate = z.object({
  report_text: z.string().optional().nullable(),
  report_status: z.string().optional().nullable(),
  performed_at: z.string().datetime().optional().nullable(),
  status: z.enum(["ordered", "in_progress", "resulted", "cancelled"]).optional(),
}).partial();
export const RadiologyOrderCreate = z.object({
  ...HeaderBase,
  items: z.array(RadiologyItemCreate).min(1),
});
export const RadiologyOrderUpdate = z.object(StatusUpdate).partial();

// ---------- Electrophysiology ----------
export const EpItemCreate = z.object({
  service_id: uuid().optional().nullable(),
  study_type: z.string().trim().optional().nullable(),
  quantity: z.number().positive().optional(),
});
export const EpItemUpdate = z.object({
  interpretation: z.string().optional().nullable(),
  performed_at: z.string().datetime().optional().nullable(),
  status: z.enum(["ordered", "in_progress", "resulted", "cancelled"]).optional(),
}).partial();
export const EpOrderCreate = z.object({
  ...HeaderBase,
  items: z.array(EpItemCreate).min(1),
});
export const EpOrderUpdate = z.object(StatusUpdate).partial();

// ---------- Service ----------
export const ServiceItemCreate = z.object({
  service_id: uuid(),
  quantity: z.number().positive().optional(),
  body_site: z.string().trim().optional().nullable(),
});
export const ServiceItemUpdate = z.object({
  performed_at: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["ordered", "in_progress", "resulted", "cancelled"]).optional(),
}).partial();
export const ServiceOrderCreate = z.object({
  ...HeaderBase,
  items: z.array(ServiceItemCreate).min(1),
});
export const ServiceOrderUpdate = z.object(StatusUpdate).partial();

// ---------- Prescription ----------
export const PrescriptionItemCreate = z.object({
  drug_id: uuid(),
  dose: z.string().trim().optional().nullable(),
  frequency: z.string().trim().optional().nullable(),
  duration: z.string().trim().optional().nullable(),
  quantity: z.number().positive().optional(),
  quantity_code: z.string().trim().optional().nullable(),
  selection_reason: z.string().trim().optional().nullable(),
  substitute_drug_id: uuid().optional().nullable(),
  // R-PBM2b: prescriber-side override. When true, the server records an
  // `rcm_gate_exception` (indication_override / pbm_indication_missing) but
  // still saves the item; without it, a missing indication returns 422.
  indication_override: z.boolean().optional(),
});
export const PrescriptionItemUpdate = z.object({
  dispense_status: z.string().optional().nullable(),
  dispensed_at: z.string().datetime().optional().nullable(),
  dispensed_by: uuid().optional().nullable(),
  status: z.enum(["ordered", "dispensed", "cancelled"]).optional(),
  indication_override: z.boolean().optional(),
}).partial();
export const PrescriptionCreate = z.object({
  ...HeaderBase,
  items: z.array(PrescriptionItemCreate).min(1),
});
export const PrescriptionUpdate = z.object(StatusUpdate).partial();

// ---------- Pricing rule ----------
export const PricingRuleCreate = z.object({
  name: nonEmpty("name"),
  scope: z.enum(["eligibility", "share", "package", "substitution", "drg_outlier", "out_of_network"]),
  priority: z.number().int().optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  action: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});
export const PricingRuleUpdate = PricingRuleCreate.partial();