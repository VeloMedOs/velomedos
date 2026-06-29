/**
 * Phase 5 — Admission MDS, Emergency MDS, Discharge MDS Zod schemas.
 * Permissive LOVs (string + length cap). Strict NPHIES LOV enforcement is
 * Phase 10.
 */
import { z } from "zod";

const lov = z.string().trim().min(1).max(64);

export const HospitalizationUpsert = z.object({
  admission_specialty: lov.optional().nullable(),
  admission_source: lov.optional().nullable(),
  origin: z.string().trim().max(256).optional().nullable(),
  intended_length_of_stay: lov.optional().nullable(),
  re_admission: lov.optional().nullable(),
  admitted_at: z.string().datetime().optional().nullable(),
  // Discharge fields normally land via the discharge route, but allowed here too.
  discharge_specialty: lov.optional().nullable(),
  discharge_disposition: lov.optional().nullable(),
  discharged_at: z.string().datetime().optional().nullable(),
}).partial();
export type HospitalizationUpsertInput = z.infer<typeof HospitalizationUpsert>;

export const EmergencyUpsert = z.object({
  triage_date: z.string().datetime().optional().nullable(),
  triage_category: lov.optional().nullable(),
  emergency_arrival_code: lov.optional().nullable(),
  emergency_service_start: z.string().datetime().optional().nullable(),
  emergency_department_disposition: lov.optional().nullable(),
}).partial();
export type EmergencyUpsertInput = z.infer<typeof EmergencyUpsert>;

export const DischargePayload = z.object({
  discharged_at: z.string().datetime(),
  separation_mode: lov, // routine | transfer | against_medical_advice | deceased | ...
  mechanical_ventilation_hours: z.number().int().nonnegative().optional().nullable(),
  cause_of_death: z.string().trim().max(512).optional().nullable(),
  discharge_specialty: lov.optional().nullable(),
  discharge_disposition: lov.optional().nullable(),
}).refine(
  (v) => v.separation_mode.toLowerCase() !== "deceased" || Boolean(v.cause_of_death),
  { message: "cause_of_death is required when separation_mode is 'deceased'", path: ["cause_of_death"] },
);
export type DischargePayloadInput = z.infer<typeof DischargePayload>;