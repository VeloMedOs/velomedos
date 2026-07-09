// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST as validateDropHandle, type ValidateDropBody } from "../scheduler.validate-drop";
import { handlePOST as elCheckHandle } from "../scheduler.bookings.$id.eligibility-check";
import { handlePATCH as statusHandle } from "../scheduler.bookings.$id.status";
import { CTX_ADMIN, seedForValidateDrop, readBody } from "./_seed";

const body: ValidateDropBody = {
  session_id: "00000000-0000-0000-0000-000000000001",
  slot_id: "s1",
  beneficiary_id: "b1",
  visit_type: "new_consult",
  source: "scheduled",
  coverage_id: "00000000-0000-0000-0000-0000000000c1",
};

describe("scheduler eligibility — post-book cycle", () => {
  it("validate → confirm-blocked → eligibility-check → confirm-succeeds", async () => {
    const { db, client } = seedForValidateDrop();
    const r1 = await validateDropHandle({ body, ctx: CTX_ADMIN, db: client });
    const j1 = await readBody(r1);
    expect(j1.ok).toBe(true);
    const bookingId = j1.data.booking_id;
    const bk1 = db.tables.clinic_bookings[0] as { eligibility_check_pending?: boolean };
    expect(bk1.eligibility_check_pending).toBe(true);

    const r2 = await statusHandle({
      params: { id: bookingId }, body: { status: "confirmed" }, ctx: CTX_ADMIN, db: client,
    });
    const j2 = await readBody(r2);
    expect(j2.code ?? j2.error).toBe("booking_confirm_eligibility_pending");

    let runCalls = 0;
    const r3 = await elCheckHandle({
      params: { id: bookingId }, ctx: CTX_ADMIN, db: client,
      runCheckFn: (async () => { runCalls++; return { ok: true, status: "active" }; }) as never,
    });
    const j3 = await readBody(r3);
    expect(j3.ok).toBe(true);
    expect(runCalls).toBe(1);
    const bk3 = db.tables.clinic_bookings[0] as { eligibility_check_pending?: boolean };
    expect(bk3.eligibility_check_pending).toBe(false);

    const r4 = await statusHandle({
      params: { id: bookingId }, body: { status: "confirmed" }, ctx: CTX_ADMIN, db: client,
    });
    const j4 = await readBody(r4);
    expect(j4.ok).toBe(true);
  });
});