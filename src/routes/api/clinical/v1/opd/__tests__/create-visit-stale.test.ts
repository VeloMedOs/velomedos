// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST, type CreateVisitBody } from "../registration.create-visit";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "front_office" as const };
const NOW = new Date("2026-07-10T09:00:00Z");

function baseSeed(veCheckedAt: string | null, veStatus = "eligible") {
  const tables: Record<string, Record<string, unknown>[]> = {
    beneficiary: [{ id: "b1", tenant_id: TENANT, full_name: "T", patient_file_no: "MRN0001", contact_number: "555000", country_code: "+966", preferred_language: "en" }],
    clinics:     [{ id: "cl1", tenant_id: TENANT, name: "GP-A" }],
    visit_eligibility: veCheckedAt === null ? [] : [{ id: "ve1", tenant_id: TENANT, beneficiary_id: "b1", status: veStatus, financial_type: "insured", eligibility_type: "standard", checked_at: veCheckedAt }],
    clinic_bookings: [],
    encounter: [],
    interface_log: [],
  };
  return makeMockDb({ tables });
}

const BODY: CreateVisitBody = { beneficiary_id: "b1", clinic_id: "cl1" };

describe("opd/registration/create-visit — eligibility gate", () => {
  it("no eligibility row → 409 eligibility_stale, no writes", async () => {
    const { client, db } = baseSeed(null);
    const res = await handlePOST({ body: BODY, ctx: CTX, db: client, now: NOW });
    expect(res.status).toBe(409);
    const j = await res.json();
    expect(j.code).toBe("eligibility_stale");
    expect(db.tables.encounter.length).toBe(0);
    expect(db.tables.clinic_bookings.length).toBe(0);
  });

  it("stale eligibility (>24h) → 409 eligibility_stale", async () => {
    const { client } = baseSeed(new Date(NOW.getTime() - 30 * 3600 * 1000).toISOString());
    const res = await handlePOST({ body: BODY, ctx: CTX, db: client, now: NOW });
    expect(res.status).toBe(409);
    const j = await res.json();
    expect(j.code).toBe("eligibility_stale");
  });

  it("fresh eligibility → creates encounter + booking + fires SMS stub", async () => {
    const { client, db } = baseSeed(new Date(NOW.getTime() - 60 * 1000).toISOString());
    const res = await handlePOST({ body: BODY, ctx: CTX, db: client, now: NOW });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(db.tables.encounter.length).toBe(1);
    expect(db.tables.clinic_bookings.length).toBe(1);
    expect(db.tables.interface_log.length).toBe(1);
    expect((db.tables.interface_log[0] as any).trigger).toBe("visit_confirmation");
  });

  it("fresh but standard/not-eligible → 403 not_eligible", async () => {
    const { client, db } = baseSeed(new Date(NOW.getTime() - 60 * 1000).toISOString(), "not_eligible");
    const res = await handlePOST({ body: BODY, ctx: CTX, db: client, now: NOW });
    expect(res.status).toBe(403);
    const j = await res.json();
    expect(j.code).toBe("not_eligible");
    expect(db.tables.encounter.length).toBe(0);
  });
});