// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { walletGateAllowsOrder } from "@/lib/rcm/wallet-gate";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";

function seed(over: { encClass?: string; balance?: number | null; walletMissing?: boolean } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    encounter: [{ id: "e1", tenant_id: TENANT, class: over.encClass ?? "AMB", beneficiary_id: "b1" }],
    patient_wallet: over.walletMissing
      ? []
      : [{ id: "w1", tenant_id: TENANT, beneficiary_id: "b1", balance_minor: over.balance ?? 0 }],
  };
  return makeMockDb({
    tables,
    rpc: (name, args) => {
      if (name !== "wallet_gate_open") return null;
      const w = tables.patient_wallet.find(
        (r) => r.beneficiary_id === args._beneficiary_id && r.tenant_id === args._tenant_id,
      );
      if (!w) return true; // missing wallet = open
      return Number((w as any).balance_minor) >= 0;
    },
  });
}

describe("_order-factory · wallet gate (file 17 §4)", () => {
  it("negative wallet → gate closed (403 wallet_gate)", async () => {
    const { client } = seed({ balance: -500 });
    const r = await walletGateAllowsOrder(client, TENANT, "e1");
    expect(r.open).toBe(false);
    if (!r.open) expect(r.beneficiary_id).toBe("b1");
  });

  it("positive wallet → gate open", async () => {
    const { client } = seed({ balance: 1000 });
    const r = await walletGateAllowsOrder(client, TENANT, "e1");
    expect(r.open).toBe(true);
  });

  it("missing wallet → gate open", async () => {
    const { client } = seed({ walletMissing: true });
    const r = await walletGateAllowsOrder(client, TENANT, "e1");
    expect(r.open).toBe(true);
  });

  it("non-AMB (IP) encounter → gate open regardless of balance", async () => {
    const { client } = seed({ encClass: "IMP", balance: -9999 });
    const r = await walletGateAllowsOrder(client, TENANT, "e1");
    expect(r.open).toBe(true);
  });
});