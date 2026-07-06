/**
 * Emergency reconcile fixtures — mocked Supabase, no network.
 *
 * Contract:
 *   - +delta (nphies > manual) → wallet credit via wallet_apply_txn RPC
 *     with signed positive delta; wallet_txn direction = "credit".
 *   - −delta (nphies < manual) → wallet debit via RPC with signed negative
 *     delta; wallet_txn direction = "debit".
 *   - Idempotency: second call on same exception → { ok:true, already:true },
 *     RPC NOT called again.
 *   - Zero delta: RPC not called; exception stamped reconciled_at.
 */
// @ts-expect-error — bun-types conflicts with @supabase/supabase-js fetch typing.
import { describe, expect, it } from "bun:test";
import { reconcileEmergencyException, computeWalletDelta } from "./emergency-reconcile";

const TENANT = "00000000-0000-0000-0000-000000000001";
const ENC = "00000000-0000-0000-0000-0000000000e1";
const BEN = "00000000-0000-0000-0000-0000000000b1";
const WALLET = "00000000-0000-0000-0000-0000000000w1";

type ExceptionRow = {
  id: string; tenant_id: string; encounter_id: string;
  manual_approved_minor: number | null;
  reconciled_at: string | null; exception_type: string;
};

function createFake(exc: ExceptionRow) {
  const rpcCalls: Array<{ name: string; args: any }> = [];
  const walletTxns: any[] = [];
  const excUpdates: any[] = [];
  const walletsCreated: any[] = [];

  const db: any = {
    from(table: string) {
      const chain: any = {
        _table: table,
        _filters: {} as Record<string, unknown>,
        select() { return chain; },
        eq(col: string, v: unknown) { chain._filters[col] = v; return chain; },
        is() { return chain; },
        maybeSingle: async () => {
          if (table === "rcm_gate_exception") return { data: exc, error: null };
          if (table === "encounter") return { data: { beneficiary_id: BEN }, error: null };
          if (table === "patient_wallet") return { data: { id: WALLET }, error: null };
          return { data: null, error: null };
        },
        single: async () => {
          if (table === "wallet_txn") {
            const row = { id: `txn-${walletTxns.length + 1}` };
            return { data: row, error: null };
          }
          if (table === "patient_wallet") {
            const row = { id: WALLET };
            walletsCreated.push(row);
            return { data: row, error: null };
          }
          return { data: null, error: null };
        },
        insert(vals: any) {
          if (table === "wallet_txn") walletTxns.push(vals);
          return chain;
        },
        update(vals: any) {
          if (table === "rcm_gate_exception") {
            excUpdates.push(vals);
            // Simulate stamp: subsequent reads see reconciled_at set.
            exc.reconciled_at = vals.reconciled_at ?? exc.reconciled_at;
          }
          return chain;
        },
      };
      return chain;
    },
    rpc(name: string, args: any) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return { db, rpcCalls, walletTxns, excUpdates };
}

describe("computeWalletDelta", () => {
  it("returns nphies − manual", () => {
    expect(computeWalletDelta(100, 150)).toBe(50);
    expect(computeWalletDelta(150, 100)).toBe(-50);
    expect(computeWalletDelta(100, 100)).toBe(0);
  });
});

describe("reconcileEmergencyException", () => {
  it("1 · +delta → credit, wallet_apply_txn called once with +50", async () => {
    const exc: ExceptionRow = {
      id: "e1", tenant_id: TENANT, encounter_id: ENC,
      manual_approved_minor: 100, reconciled_at: null,
      exception_type: "emergency_override",
    };
    const fake = createFake(exc);
    const res = await reconcileEmergencyException(fake.db, {
      exceptionId: "e1", nphiesApprovedMinor: 150,
    });
    expect(res.ok).toBe(true);
    if (res.ok && !("already" in res && res.already === true)) {
      expect((res as any).direction).toBe("credit");
      expect((res as any).wallet_delta_minor).toBe(50);
    }
    expect(fake.rpcCalls.length).toBe(1);
    expect(fake.rpcCalls[0].name).toBe("wallet_apply_txn");
    expect(fake.rpcCalls[0].args._delta_minor).toBe(50);
  });

  it("2 · −delta → debit, RPC called with −50", async () => {
    const exc: ExceptionRow = {
      id: "e2", tenant_id: TENANT, encounter_id: ENC,
      manual_approved_minor: 150, reconciled_at: null,
      exception_type: "emergency_override",
    };
    const fake = createFake(exc);
    const res = await reconcileEmergencyException(fake.db, {
      exceptionId: "e2", nphiesApprovedMinor: 100,
    });
    expect(res.ok).toBe(true);
    if (res.ok && !("already" in res && res.already === true)) {
      expect((res as any).direction).toBe("debit");
    }
    expect(fake.rpcCalls[0].args._delta_minor).toBe(-50);
  });

  it("3 · idempotent — second call short-circuits, RPC not invoked", async () => {
    const exc: ExceptionRow = {
      id: "e3", tenant_id: TENANT, encounter_id: ENC,
      manual_approved_minor: 100,
      reconciled_at: "2026-01-01T00:00:00Z",
      exception_type: "emergency_override",
    };
    const fake = createFake(exc);
    const res = await reconcileEmergencyException(fake.db, {
      exceptionId: "e3", nphiesApprovedMinor: 150,
    });
    expect(res).toEqual({ ok: true, already: true });
    expect(fake.rpcCalls.length).toBe(0);
  });

  it("4 · zero delta → no RPC, exception still stamped reconciled_at", async () => {
    const exc: ExceptionRow = {
      id: "e4", tenant_id: TENANT, encounter_id: ENC,
      manual_approved_minor: 100, reconciled_at: null,
      exception_type: "emergency_override",
    };
    const fake = createFake(exc);
    const res = await reconcileEmergencyException(fake.db, {
      exceptionId: "e4", nphiesApprovedMinor: 100,
    });
    expect(res.ok).toBe(true);
    expect(fake.rpcCalls.length).toBe(0);
    expect(fake.excUpdates.length).toBe(1);
    expect(fake.excUpdates[0].reconciled_at).toBeTruthy();
  });
});