// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST, type ValidateDropBody } from "../scheduler.validate-drop";
import { CTX_ADMIN, CTX_PHYSICIAN, seedForValidateDrop, readBody } from "./_seed";

const body: ValidateDropBody = {
  session_id: "00000000-0000-0000-0000-000000000001",
  slot_id: "s1",
  beneficiary_id: "b1",
  visit_type: "new_consult",
  source: "scheduled",
};

describe("scheduler.validate-drop — DD5 overbook two-path", () => {
  it("within overbook_limit + role has overbook cap → ok + overbook_warning + overbooked=true", async () => {
    const { db, client } = seedForValidateDrop({
      slot: { capacity: 1, booked_count: 1 },
      schedule: { overbook_allowed: true, overbook_limit: 2 },
    });
    const res = await handlePOST({ body, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.ok).toBe(true);
    expect(j.overbook_warning).toBe(true);
    const inserted = (db.tables.clinic_bookings ?? []) as Array<{ overbooked?: boolean }>;
    expect(inserted.length).toBe(1);
    expect(inserted[0].overbooked).toBe(true);
  });

  it("within overbook_limit + role lacks overbook cap → slot_capacity_full", async () => {
    const { client } = seedForValidateDrop({
      slot: { capacity: 1, booked_count: 1 },
      schedule: { overbook_allowed: true, overbook_limit: 2 },
    });
    const res = await handlePOST({ body, ctx: CTX_PHYSICIAN, db: client });
    const j = await readBody(res);
    expect(j.code ?? j.error).toBe("slot_capacity_full");
  });

  it("beyond overbook_limit even with cap → slot_capacity_full", async () => {
    const { client } = seedForValidateDrop({
      slot: { capacity: 1, booked_count: 3 },
      schedule: { overbook_allowed: true, overbook_limit: 2 },
    });
    const res = await handlePOST({ body, ctx: CTX_ADMIN, db: client });
    const j = await readBody(res);
    expect(j.code ?? j.error).toBe("slot_capacity_full");
  });
});