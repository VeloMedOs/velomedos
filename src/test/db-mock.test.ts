/**
 * Self-tests for the DB-mock harness.
 *
 * Proves the three properties the route fixtures depend on:
 *   1. Atomicity — concurrent UPDATEs with a WHERE predicate mutate in
 *      place; the losing call sees 0 rows.
 *   2. Nested PostgREST joins — `alias:fk_col ( ... )` resolves against
 *      the referenced table by convention `<table>_id → <table>`.
 *   3. Call log — every terminal op is recorded with filter chain + payload.
 */
// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { makeMockDb } from "./db-mock";

describe("db-mock — atomicity", () => {
  it("two concurrent updates with WHERE status='open' — only one wins", async () => {
    const { db, client } = makeMockDb({
      tables: { clinic_slot: [{ id: "s1", status: "open" }] },
    });

    const claim = () => client.from("clinic_slot")
      .update({ status: "held" })
      .eq("id", "s1")
      .eq("status", "open")
      .select("id");

    const [a, b] = await Promise.all([claim(), claim()]);
    const winners = [a, b].filter((r) => Array.isArray(r.data) && (r.data as unknown[]).length === 1);
    const losers  = [a, b].filter((r) => Array.isArray(r.data) && (r.data as unknown[]).length === 0);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(1);
    expect((db.tables.clinic_slot[0] as { status: string }).status).toBe("held");
  });
});

describe("db-mock — nested PostgREST joins", () => {
  it("resolves alias:fk_col ( child:fk_col ( leaf ) ) two levels deep", async () => {
    const { client } = makeMockDb({
      tables: {
        beneficiary: [{ id: "b1", full_name: "Ali" }],
        encounter:   [{ id: "e1", beneficiary_id: "b1" }],
        referral:    [{ id: "r1", source_encounter_id: "e1" }],
      },
    });

    const { data } = await client.from("referral")
      .select("id, encounter:source_encounter_id ( id, beneficiary:beneficiary_id ( full_name ) )")
      .eq("id", "r1")
      .single();

    expect(data).toBeTruthy();
    const enc = (data as { encounter: { beneficiary: { full_name: string } } }).encounter;
    expect(enc.beneficiary.full_name).toBe("Ali");
  });
});

describe("db-mock — call log", () => {
  it("records select and update terminal ops", async () => {
    const { db, client } = makeMockDb({
      tables: { widget: [{ id: "w1", flag: false }] },
    });
    await client.from("widget").select("id").eq("id", "w1");
    await client.from("widget").update({ flag: true }).eq("id", "w1").select("id");

    expect(db.calls.length).toBe(2);
    expect(db.calls[0].op).toBe("select");
    expect(db.calls[1].op).toBe("update");
  });

  it("dispatches rpc through configured handler", async () => {
    const { db, client } = makeMockDb({
      rpc: (name, args) => ({ echoed: name, got: args }),
    });
    const res = await client.rpc("has_role", { _user_id: "u1", _role: "admin" });
    expect((res.data as { echoed: string }).echoed).toBe("has_role");
    expect(db.calls[0].op).toBe("rpc");
  });
});