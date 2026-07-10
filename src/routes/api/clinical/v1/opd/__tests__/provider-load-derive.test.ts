// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../opd.registration.provider-load";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "front_office" as const };
const NOW = new Date("2026-07-10T09:00:00Z");

function seed() {
  const today = "2026-07-10T10:00:00Z";
  const yesterday = "2026-07-09T10:00:00Z";
  return makeMockDb({
    tables: {
      clinics: [{ id: "cl1", tenant_id: TENANT }],
      providers: [
        { id: "p1", tenant_id: TENANT, clinic_id: "cl1", full_name: "Dr Alpha",   specialty: "internal_medicine" },
        { id: "p2", tenant_id: TENANT, clinic_id: "cl1", full_name: "Dr Bravo",   specialty: "internal_medicine" },
        { id: "p3", tenant_id: TENANT, clinic_id: "cl1", full_name: "Dr Charlie", specialty: "internal_medicine" },
      ],
      clinic_bookings: [
        { id: "b1", tenant_id: TENANT, clinic_id: "cl1", provider_id: "p1", status: "requested",  slot_at: today },
        { id: "b2", tenant_id: TENANT, clinic_id: "cl1", provider_id: "p1", status: "arrived",    slot_at: today },
        { id: "b3", tenant_id: TENANT, clinic_id: "cl1", provider_id: "p1", status: "in_consult", slot_at: today },
        { id: "b4", tenant_id: TENANT, clinic_id: "cl1", provider_id: "p2", status: "confirmed",  slot_at: today },
        { id: "b5", tenant_id: TENANT, clinic_id: "cl1", provider_id: "p2", status: "cancelled",  slot_at: today },
        { id: "b6", tenant_id: TENANT, clinic_id: "cl1", provider_id: "p2", status: "confirmed",  slot_at: yesterday },
      ],
    },
  });
}

describe("opd/registration/provider-load — in_queue_count derivation", () => {
  it("counts only today's active bookings and sorts ascending", async () => {
    const { client } = seed();
    const res = await handleGET({ clinicId: "cl1", ctx: CTX, db: client, now: NOW });
    const j = await res.json();
    expect(j.ok).toBe(true);
    const rows = j.data as Array<{ id: string; in_queue_count: number }>;
    const byId = new Map(rows.map((r) => [r.id, r.in_queue_count]));
    expect(byId.get("p1")).toBe(3);
    expect(byId.get("p2")).toBe(1);
    expect(byId.get("p3")).toBe(0);
    expect(rows.map((r) => r.id)).toEqual(["p3", "p2", "p1"]);
  });

  it("rejects clinics from another tenant", async () => {
    const { client } = seed();
    const res = await handleGET({ clinicId: "cl1", ctx: { ...CTX, tenantId: "other" }, db: client, now: NOW });
    expect(res.status).toBe(404);
  });
});