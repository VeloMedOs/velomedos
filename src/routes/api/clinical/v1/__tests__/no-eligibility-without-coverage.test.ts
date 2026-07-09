// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST as validateDropHandle, type ValidateDropBody } from "../scheduler.validate-drop";
import { handlePOST as elCheckHandle } from "../scheduler.bookings.$id.eligibility-check";
import { CTX_ADMIN, seedForValidateDrop, readBody, TENANT } from "./_seed";
import { makeMockDb } from "@/test/db-mock";

const body: ValidateDropBody = {
  session_id: "00000000-0000-0000-0000-000000000001",
  slot_id: "s1",
  beneficiary_id: "b1",
  visit_type: "new_consult",
  source: "scheduled",
  coverage_id: null,
};

describe("scheduler eligibility — no-coverage path", () => {
  it("validate-drop with coverage_id=null → booking.eligibility_check_pending=false", async () => {
    const { db, client } = seedForValidateDrop();
    const res = await validateDropHandle({ body, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.ok).toBe(true);
    const b = (db.tables.clinic_bookings[0] ?? {}) as { eligibility_check_pending?: boolean };
    expect(b.eligibility_check_pending).toBe(false);
  });

  it("eligibility-check on booking without coverage → no_coverage_for_eligibility", async () => {
    const { client } = makeMockDb({
      tables: {
        clinic_bookings: [{
          id: "bk1", tenant_id: TENANT, beneficiary_id: "b1",
          coverage_id: null, eligibility_check_pending: false,
        }],
      },
    });
    const res = await elCheckHandle({
      params: { id: "bk1" }, ctx: CTX_ADMIN, db: client,
      runCheckFn: (async () => { throw new Error("runCheck should not be invoked without coverage"); }) as never,
    });
    const j = await readBody(res);
    expect(j.code ?? j.error).toBe("no_coverage_for_eligibility");
  });
});