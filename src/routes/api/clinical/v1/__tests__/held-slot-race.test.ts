// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST, type ValidateDropBody } from "../scheduler.validate-drop";
import { CTX_ADMIN, seedForValidateDrop, readBody } from "./_seed";

const body: ValidateDropBody = {
  session_id: "00000000-0000-0000-0000-000000000001",
  slot_id: "s1",
  beneficiary_id: "b1",
  visit_type: "new_consult",
  source: "scheduled",
};

describe("scheduler.validate-drop — held-slot race", () => {
  it("two concurrent calls: exactly one ok, one slot_just_taken", async () => {
    const { db, client } = seedForValidateDrop();
    const [a, b] = await Promise.all([
      handlePOST({ body, ctx: CTX_ADMIN, db: client }),
      handlePOST({ body, ctx: CTX_ADMIN, db: client }),
    ]);
    const ja = await readBody(a);
    const jb = await readBody(b);
    const wins = [ja, jb].filter((r) => r.ok === true).length;
    const losses = [ja, jb].filter((r) => r.code === "slot_just_taken" || r.error === "slot_just_taken").length;
    expect(wins).toBe(1);
    expect(losses).toBe(1);
    const finalSlot = db.tables.clinic_slot[0] as { status: string; held_until: string };
    expect(finalSlot.status).toBe("held");
    expect(new Date(finalSlot.held_until).getTime()).toBeGreaterThan(Date.now());
  });
});