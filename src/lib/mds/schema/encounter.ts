/**
 * Zod schemas for Phase 2 — Encounter / Diagnosis / CareTeam / Vitals / SupportingInfo.
 * Permissive in Phase 2; Phase 10 tightens.
 */
import { z } from "zod";

const nonEmpty = (label: string) => z.string().trim().min(1, `${label} is required`);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const EncounterClass = z.enum(["AMB", "EMER", "IMP", "HH", "VR"]);
export const EncounterClinicalStatusEnum = z.enum([
  "planned", "arrived", "triaged", "in_progress", "on_leave", "finished", "cancelled",
]);

// ---------- Episode of care ----------
export const EpisodeOfCareCreate = z.object({
  beneficiary_id: z.string().uuid(),
  status: z.enum(["active", "finished", "cancelled"]).optional(),
  care_type: z.string().trim().optional().nullable(),
  start_date: dateStr.optional(),
  end_date: dateStr.optional().nullable(),
  primary_practitioner_id: z.string().uuid().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
export const EpisodeOfCareUpdate = EpisodeOfCareCreate.partial();
export type EpisodeOfCareCreateInput = z.infer<typeof EpisodeOfCareCreate>;

// ---------- Encounter ----------
export const EncounterCreate = z.object({
  beneficiary_id: z.string().uuid(),
  class: EncounterClass,
  episode_of_care_id: z.string().uuid().optional().nullable(),
  coverage_id: z.string().uuid().optional().nullable(),
  type: z.string().trim().optional().nullable(),
  service_type: z.string().trim().optional().nullable(),
  priority: z.string().trim().optional().nullable(),
  period_start: z.string().datetime().optional(),
  reason_text: z.string().trim().optional().nullable(),
  chief_complaint: z.string().trim().optional().nullable(),
  // Restored grouper/pricing fields (optional now; Phase 5 populates at discharge)
  same_day: z.boolean().optional().nullable(),
  mechanical_ventilation_hours: z.number().int().nonnegative().optional().nullable(),
  separation_mode: z.string().trim().optional().nullable(),
  cause_of_death: z.string().trim().optional().nullable(),
  discharge_disposition: z.string().trim().optional().nullable(),
});
export type EncounterCreateInput = z.infer<typeof EncounterCreate>;

// Excludes status and journey_state — those have dedicated routes.
export const EncounterUpdate = z.object({
  episode_of_care_id: z.string().uuid().optional().nullable(),
  coverage_id: z.string().uuid().optional().nullable(),
  type: z.string().trim().optional().nullable(),
  service_type: z.string().trim().optional().nullable(),
  priority: z.string().trim().optional().nullable(),
  period_start: z.string().datetime().optional(),
  reason_text: z.string().trim().optional().nullable(),
  chief_complaint: z.string().trim().optional().nullable(),
  same_day: z.boolean().optional().nullable(),
  mechanical_ventilation_hours: z.number().int().nonnegative().optional().nullable(),
  separation_mode: z.string().trim().optional().nullable(),
  cause_of_death: z.string().trim().optional().nullable(),
  discharge_disposition: z.string().trim().optional().nullable(),
}).partial();

export const EncounterAdvance = z.object({
  to: EncounterClinicalStatusEnum,
  reason: z.string().trim().optional(),
  period_end: z.string().datetime().optional(),
});
export type EncounterAdvanceInput = z.infer<typeof EncounterAdvance>;

// ---------- Diagnosis ----------
export const DiagnosisCreate = z.object({
  code: nonEmpty("code"),
  code_system: z.string().trim().optional(),
  display: z.string().trim().optional().nullable(),
  role: z.enum(["admission", "principal", "secondary", "discharge", "external_cause"]).optional(),
  rank: z.number().int().positive().optional().nullable(),
  present_on_admission: z.enum(["Y", "N", "U", "W"]).optional().nullable(),
  is_chronic: z.boolean().optional(),
  onset_date: dateStr.optional().nullable(),
});
export const DiagnosisUpdate = DiagnosisCreate.partial();

// ---------- Care team ----------
export const CareTeamMemberCreate = z.object({
  practitioner_user_id: z.string().uuid(),
  role: nonEmpty("role"),
  is_primary: z.boolean().optional(),
  period_start: z.string().datetime().optional(),
  period_end: z.string().datetime().optional().nullable(),
});
export const CareTeamMemberUpdate = z.object({
  role: z.string().trim().min(1).optional(),
  is_primary: z.boolean().optional(),
  period_start: z.string().datetime().optional(),
  period_end: z.string().datetime().optional().nullable(),
}).partial();

// ---------- Vitals ----------
const VITAL_MEASURE_FIELDS = [
  "temperature_c", "heart_rate_bpm", "respiratory_rate_bpm", "systolic_mmhg",
  "diastolic_mmhg", "spo2_pct", "pain_score", "weight_kg", "height_cm", "glucose_mmol_l",
] as const;

export const VitalsCreate = z.object({
  recorded_at: z.string().datetime().optional(),
  body_position: z.string().trim().optional().nullable(),
  body_site: z.string().trim().optional().nullable(),
  temperature_c: z.number().optional().nullable(),
  heart_rate_bpm: z.number().int().optional().nullable(),
  respiratory_rate_bpm: z.number().int().optional().nullable(),
  systolic_mmhg: z.number().int().optional().nullable(),
  diastolic_mmhg: z.number().int().optional().nullable(),
  spo2_pct: z.number().optional().nullable(),
  pain_score: z.number().int().min(0).max(10).optional().nullable(),
  weight_kg: z.number().optional().nullable(),
  height_cm: z.number().optional().nullable(),
  glucose_mmol_l: z.number().optional().nullable(),
  news2_score: z.number().int().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
}).refine(
  (v) => VITAL_MEASURE_FIELDS.some((f) => v[f] !== null && v[f] !== undefined),
  { message: "At least one measure is required" },
);
export const VitalsUpdate = z.object({
  recorded_at: z.string().datetime().optional(),
  body_position: z.string().trim().optional().nullable(),
  body_site: z.string().trim().optional().nullable(),
  temperature_c: z.number().optional().nullable(),
  heart_rate_bpm: z.number().int().optional().nullable(),
  respiratory_rate_bpm: z.number().int().optional().nullable(),
  systolic_mmhg: z.number().int().optional().nullable(),
  diastolic_mmhg: z.number().int().optional().nullable(),
  spo2_pct: z.number().optional().nullable(),
  pain_score: z.number().int().min(0).max(10).optional().nullable(),
  weight_kg: z.number().optional().nullable(),
  height_cm: z.number().optional().nullable(),
  glucose_mmol_l: z.number().optional().nullable(),
  news2_score: z.number().int().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
}).partial();

// ---------- Supporting info ----------
export const SupportingInfoCategory = z.enum([
  "history_of_present_illness",
  "physical_examination",
  "treatment_plan",
  "patient_history",
  "investigation_result",
  "other",
]);
export const SupportingInfoCreate = z.object({
  category: SupportingInfoCategory,
  value_text: z.string().trim().optional().nullable(),
  value_code: z.string().trim().optional().nullable(),
  code_system: z.string().trim().optional().nullable(),
  value_attachment_url: z.string().url().optional().nullable(),
  recorded_at: z.string().datetime().optional(),
  sequence: z.number().int().positive().optional().nullable(),
}).refine(
  (v) => Boolean(v.value_text || v.value_code || v.value_attachment_url),
  { message: "At least one of value_text / value_code / value_attachment_url is required" },
);
export const SupportingInfoUpdate = z.object({
  category: SupportingInfoCategory.optional(),
  value_text: z.string().trim().optional().nullable(),
  value_code: z.string().trim().optional().nullable(),
  code_system: z.string().trim().optional().nullable(),
  value_attachment_url: z.string().url().optional().nullable(),
  recorded_at: z.string().datetime().optional(),
  sequence: z.number().int().positive().optional().nullable(),
}).partial();