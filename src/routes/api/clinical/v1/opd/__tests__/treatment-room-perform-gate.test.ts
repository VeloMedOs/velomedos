// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST } from "../opd.treatment-room.perform";
import { makeMockDb } from "@/test/db-mock";

const T = "t1";
const CTX = { tenantId: T, userId: "u1", clinicalRole: "nurse" as const };

function db(opts: { billed?: boolean } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    service_order_item: [{ id: "s1", tenant_id: T, status: "ordered" }],
  };
  const m = makeMockDb({ tables });
  if (opts.billed === false) {
    // Simulate trigger raise on update by monkey-patching from()
    const orig = m.client.from.bind(m.client);
    m.client.from = ((name: string) => {
      const chain = orig(name);
      const _update = chain.update.bind(chain);
      chain.update = (patch: any) => {
        const sub = _update(patch);
        const _sel = sub.select.bind(sub);
        sub.select = (...a: any[]) => {
          const s = _sel(...a);
          s.maybeSingle = async () => ({ data: null, error: { message: "billed gate failed: charge not billed" } });
          return s;
        };
        return sub;
      };
      return chain;
    }) as any;
  }
  return m.client;
}

describe("treatment-room/perform — billed gate", () => {
  it("unbilled → 403 billed_gate", async () => {
    const res = await handlePOST({
      body: { order_item_table: "service_order_item", order_item_id: "s1" },
      ctx: CTX, db: db({ billed: false }),
    });
    expect(res.status).toBe(403);
    const j = await res.json();
    expect(j.code).toBe("billed_gate");
  });
  it("billed → 200", async () => {
    const res = await handlePOST({
      body: { order_item_table: "service_order_item", order_item_id: "s1" },
      ctx: CTX, db: db(),
    });
    expect(res.status).toBe(200);
  });
  it("invalid order_item_table → 422 validation_failed", async () => {
    const res = await handlePOST({
      body: { order_item_table: "not_a_real_table", order_item_id: "s1" },
      ctx: CTX, db: db(),
    });
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j.code).toBe("validation_failed");
  });
});