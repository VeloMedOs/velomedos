// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../opd.cashier.consultation-lock";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed(over: { journey?: string; bookingStatus?: string | null } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    encounter: [{ id: "e1", tenant_id: TENANT, journey_state: over.journey ?? "encounter_open" }],
    clinic_bookings: over.bookingStatus
      ? [{ id: "bk1", tenant_id: TENANT, origin_encounter_id: "e1", status: over.bookingStatus }]
      : [],
  };
  return makeMockDb({ tables });
}
async function body(res: Response) { return await res.json(); }

describe("opd/cashier/consultation-lock — KK2 derivation", () => {
  it("encounter_open + no booking → unlocked", async () => {
    const { client } = seed({});
    const res = await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client });
    const j = await body(res);
    expect(j.data.locked).toBe(false);
  });

  it("booking status=in_consult → locked (primary signal)", async () => {
    const { client } = seed({ bookingStatus: "in_consult" });
    const res = await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client });
    const j = await body(res);
    expect(j.data.locked).toBe(true);
    expect(j.data.reason).toBe("booking_in_consult");
  });

  it("journey_state=clinically_documented → locked (fallback)", async () => {
    const { client } = seed({ journey: "clinically_documented" });
    const res = await handleGET({ query: { encounter_id: "e1" }, ctx: CTX, db: client });
    const j = await body(res);
    expect(j.data.locked).toBe(true);
    expect(j.data.reason).toBe("journey_clinically_documented");
  });
});