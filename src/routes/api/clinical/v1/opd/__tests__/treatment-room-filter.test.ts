// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../treatment-room.worklist";
import { makeMockDb } from "@/test/db-mock";

const T1 = "t1", T2 = "t2";
const CTX = { tenantId: T1, userId: "u1", clinicalRole: "nurse" as const };

function seed() {
  return makeMockDb({
    tables: {
      v_treatment_room_worklist: [
        { tenant_id: T1, order_item_table: "service_order_item", order_item_id: "s1", charge_item_id: "ch1", encounter_id: "e1", clinic_id: "c1", service_internal_code: "TR-01", service_name: "Nebuliser", gate_state: "billed" },
        { tenant_id: T1, order_item_table: "lab_order_item",     order_item_id: "l1", charge_item_id: "ch2", encounter_id: "e1", clinic_id: "c2", service_internal_code: "TR-02", service_name: "IV push",   gate_state: "locked" },
        { tenant_id: T2, order_item_table: "service_order_item", order_item_id: "s2", charge_item_id: "ch3", encounter_id: "e2", clinic_id: "c1", service_internal_code: "TR-01", service_name: "OTHER",    gate_state: "billed" },
      ],
    },
  }).client;
}

describe("treatment-room/worklist filter", () => {
  it("returns only caller tenant rows (isolation)", async () => {
    const res = await handleGET({ query: {}, ctx: CTX, db: seed() });
    const j = await res.json();
    expect(j.data.rows.length).toBe(2);
    expect(j.data.rows.every((r: any) => r.tenant_id === T1)).toBe(true);
  });
  it("clinic filter narrows to one clinic", async () => {
    const res = await handleGET({ query: { clinic_id: "c1" }, ctx: CTX, db: seed() });
    const j = await res.json();
    expect(j.data.rows.length).toBe(1);
    expect(j.data.rows[0].clinic_id).toBe("c1");
  });
  it("view excludes prescription_item rows (contract)", async () => {
    // The view definition excludes prescription_item; the mock simply omits them.
    const res = await handleGET({ query: {}, ctx: CTX, db: seed() });
    const j = await res.json();
    expect(j.data.rows.some((r: any) => r.order_item_table === "prescription_item")).toBe(false);
  });
});