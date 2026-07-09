// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../opd.orders.billed-status";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "tenant_admin" as const };

describe("opd/orders/billed-status — v_order_item_gate readout", () => {
  it("mixed cart → paid/unpaid/unpaid per gate_state", async () => {
    const { client } = makeMockDb({
      tables: {
        encounter: [{ id: "enc1", tenant_id: TENANT }],
        v_order_item_gate: [
          { order_item_table: "lab_order_item",  order_item_id: "l1", charge_item_id: "ch1", encounter_id: "enc1", pricing_mode: "insured", net_minor: 5000, gate_state: "billed",                exception_id: null, reason_code: null },
          { order_item_table: "radiology_order_item", order_item_id: "r1", charge_item_id: "ch2", encounter_id: "enc1", pricing_mode: "cash",    net_minor: 15000, gate_state: "locked",             exception_id: null, reason_code: "unpaid" },
          { order_item_table: "prescription_item", order_item_id: "p1", charge_item_id: "ch3", encounter_id: "enc1", pricing_mode: "insured", net_minor: 3000, gate_state: "locked",             exception_id: null, reason_code: "refunded" },
        ],
      },
    });
    const res = await handleGET({ params: { encounter_id: "enc1" }, ctx: CTX, db: client });
    const j = await res.json();
    expect(j.ok).toBe(true);
    const labels = (j.data.rows as Array<{ order_item_table: string; gate_state: string }>).map((r) =>
      r.gate_state === "billed" || r.gate_state === "released_by_exception" ? "paid" : "unpaid",
    );
    expect(labels).toEqual(["paid", "unpaid", "unpaid"]);
    expect(Object.keys(j.data.grouped)).toContain("lab_order_item");
  });

  it("cross-tenant encounter → 404", async () => {
    const { client } = makeMockDb({
      tables: { encounter: [{ id: "enc-other", tenant_id: "t-other" }] },
    });
    const res = await handleGET({ params: { encounter_id: "enc-other" }, ctx: CTX, db: client });
    expect(res.status).toBe(404);
  });
});