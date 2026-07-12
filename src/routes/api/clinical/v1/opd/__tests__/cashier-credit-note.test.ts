// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST } from "../cashier.credit-note";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed(over: {
  itemTable?: string;
  itemStatus?: string;
  dispenseStatus?: string;
  serviceType?: string;
  bookingStatus?: string | null;
  authReqId?: string | null;
} = {}) {
  const itemTable = over.itemTable ?? "lab_order_item";
  const tables: Record<string, Record<string, unknown>[]> = {
    encounter: [{ id: "e1", tenant_id: TENANT, beneficiary_id: "b1", journey_state: "encounter_open" }],
    charge_item: [{
      id: "c1", tenant_id: TENANT, encounter_id: "e1",
      service_id: "s1", order_item_table: itemTable, order_item_id: "oi1",
      patient_share_minor: 400, net_minor: 500, status: "posted",
    }],
    service_master: [{ id: "s1", tenant_id: TENANT, service_type: over.serviceType ?? "lab", internal_code: "LAB1" }],
    [itemTable]: itemTable === "prescription_item"
      ? [{ id: "oi1", dispense_status: over.dispenseStatus ?? "pending" }]
      : [{ id: "oi1", status: over.itemStatus ?? "ordered" }],
    patient_wallet: [{ id: "w1", tenant_id: TENANT, beneficiary_id: "b1", balance_minor: 0 }],
    credit_note: [],
    wallet_txn: [],
    clinic_bookings: over.bookingStatus
      ? [{ id: "bk1", tenant_id: TENANT, origin_encounter_id: "e1", status: over.bookingStatus }]
      : [],
    authorization_item: over.authReqId
      ? [{ id: "ai1", charge_item_id: "c1", authorization_request_id: over.authReqId }]
      : [],
    authorization_request: over.authReqId
      ? [{ id: over.authReqId, tenant_id: TENANT, status: "approved" }]
      : [],
  };
  return makeMockDb({
    tables,
    rpc: (name) => (name === "wallet_apply_txn" ? 400 : null),
  });
}
async function body(res: Response) { return await res.json(); }

describe("opd/cashier/credit-note — KK6 guards", () => {
  it("performed lab item → 422 item_already_performed", async () => {
    const { client } = seed({ itemStatus: "resulted" });
    const res = await handlePOST({
      body: { encounter_id: "e1", charge_item_ids: ["c1"], reason: "duplicate" },
      ctx: CTX, db: client,
    });
    expect(res.status).toBe(422);
    const j = await body(res);
    expect(j.code).toBe("item_already_performed");
  });

  it("dispensed prescription → 422 item_already_performed", async () => {
    const { client } = seed({ itemTable: "prescription_item", dispenseStatus: "dispensed" });
    const res = await handlePOST({
      body: { encounter_id: "e1", charge_item_ids: ["c1"], reason: "duplicate" },
      ctx: CTX, db: client,
    });
    expect(res.status).toBe(422);
    const j = await body(res);
    expect(j.code).toBe("item_already_performed");
  });

  it("consultation fee + booking in_consult → 409 consultation_locked", async () => {
    const { client } = seed({ serviceType: "consultation", bookingStatus: "in_consult" });
    const res = await handlePOST({
      body: { encounter_id: "e1", charge_item_ids: ["c1"], reason: "err" },
      ctx: CTX, db: client,
    });
    expect(res.status).toBe(409);
    const j = await body(res);
    expect(j.code).toBe("consultation_locked");
  });

  it("happy path → credit_note inserted, wallet via RPC, auth cancelled", async () => {
    const { client, db } = seed({ authReqId: "areq1" });
    const res = await handlePOST({
      body: { encounter_id: "e1", charge_item_ids: ["c1"], reason: "duplicate order" },
      ctx: CTX, db: client,
    });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(db.calls.some((c) => c.table === "credit_note" && c.op === "insert")).toBe(true);
    expect(db.calls.some((c) => c.op === "rpc" && (c.args as any).name === "wallet_apply_txn")).toBe(true);
    expect(db.calls.some((c) => c.table === "patient_wallet" && c.op === "update")).toBe(false);
    const areq = db.tables.authorization_request?.find((r) => r.id === "areq1");
    expect((areq as any)?.status).toBe("cancelled");
  });
});