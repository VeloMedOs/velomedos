/**
 * Shared seed helpers for Turn 4 scheduler route fixtures. Every fixture
 * builds a fresh mock db per sub-test — no shared mutable state.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeMockDb } from "@/test/db-mock";

export const TENANT = "t1";
export const USER = "u1";

export const CTX_ADMIN = { tenantId: TENANT, userId: USER, clinicalRole: "tenant_admin" as const };
export const CTX_PHYSICIAN = { tenantId: TENANT, userId: USER, clinicalRole: "physician" as const };

export type SeedOverrides = {
  slot?: Record<string, unknown>;
  schedule?: Record<string, unknown>;
  beneficiary?: Record<string, unknown>;
  service?: Record<string, unknown> | null;
  slot_block?: Array<Record<string, unknown>>;
  prior_bookings?: Array<Record<string, unknown>>;
};

export function seedForValidateDrop(over: SeedOverrides = {}) {
  const slotAt = new Date().toISOString();
  const tables: Record<string, Record<string, unknown>[]> = {
    clinic_slot: [{
      id: "s1", schedule_id: "sch1", slot_at: slotAt, status: "open",
      capacity: 5, booked_count: 0, tenant_id: TENANT,
      ...(over.slot ?? {}),
    }],
    clinic_schedule: [{
      id: "sch1", tenant_id: TENANT, slot_duration_min: 30,
      overbook_allowed: false, overbook_limit: 0, female_clinic: false,
      specialty: "endo", clinic_id: "c1", provider_id: "p1",
      age_min: null, age_max: null,
      ...(over.schedule ?? {}),
    }],
    beneficiary: [{
      id: "b1", tenant_id: TENANT, gender: "male", dob: "2000-01-01",
      ...(over.beneficiary ?? {}),
    }],
    service_master: over.service ? [{ id: "svc1", ...over.service }] : [],
    slot_block: over.slot_block ?? [],
    pricing_rule: [],
    clinic_bookings: over.prior_bookings ?? [],
    booking_event: [],
  };
  return { ...makeMockDb({ tables }), slotAt };
}

export async function readBody(res: Response): Promise<any> {
  return await res.json();
}