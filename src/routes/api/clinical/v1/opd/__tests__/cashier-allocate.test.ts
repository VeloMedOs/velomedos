// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST } from "../cashier.allocate";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed() {
  return makeMockDb({
    tables: {
      encounter: [{ id: "e1", tenant_id: TENANT, beneficiary_id: "b1" }],
      deposit: [{ id: "d1", tenant_id: TENANT, beneficiary_id: "b1", available_minor: 10000 }],
      patient_wallet: [{ id: "w1", tenant_id: TENANT, beneficiary_id: "b1", balance_minor: 5000 }],
      v_order_item_gate: [],
    },
    rpc: (name) => (name === "wallet_apply_txn" ? 3000 : null),
  });
}
async function body(res: Response) { return await res.json(); }

describe("opd/cashier/allocate — three methods", () => {
  it("deposit path → inserts deposit_transaction", async () => {
    const { client, db } = seed();
    const res = await handlePOST({
      body: { encounter_id: "e1", allocations: [{ charge_item_id: "c1", amount_minor: 500, method: "deposit", deposit_id: "d1" }] },
      ctx: CTX, db: client,
    });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(db.calls.some((c) => c.table === "deposit_transaction" && c.op === "insert")).toBe(true);
    expect(db.calls.some((c) => c.table === "patient_wallet" && c.op === "update")).toBe(false);
  });

  it("cash path → inserts cash_collection", async () => {
    const { client, db } = seed();
    const res = await handlePOST({
      body: { encounter_id: "e1", allocations: [{ charge_item_id: "c1", amount_minor: 300, method: "cash" }] },
      ctx: CTX, db: client,
    });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(db.calls.some((c) => c.table === "cash_collection" && c.op === "insert")).toBe(true);
  });

  it("wallet path → wallet_txn + wallet_apply_txn RPC (no direct wallet update)", async () => {
    const { client, db } = seed();
    const res = await handlePOST({
      body: { encounter_id: "e1", allocations: [{ charge_item_id: "c1", amount_minor: 200, method: "wallet" }] },
      ctx: CTX, db: client,
    });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(db.calls.some((c) => c.table === "wallet_txn" && c.op === "insert")).toBe(true);
    expect(db.calls.some((c) => c.op === "rpc" && (c.args as any).name === "wallet_apply_txn")).toBe(true);
    expect(db.calls.some((c) => c.table === "patient_wallet" && c.op === "update")).toBe(false);
  });
});