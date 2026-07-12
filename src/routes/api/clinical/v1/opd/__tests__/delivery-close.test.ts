// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST } from "../maternity.delivery-close";
import { makeMockDb } from "@/test/db-mock";

const T = "t1";
const CTX = { tenantId: T, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed(status = "active", end_date: string | null = null) {
  return makeMockDb({
    tables: {
      episode_of_care: [{ id: "ep1", tenant_id: T, status, end_date, care_type: "pregnancy" }],
    },
  });
}

async function j(r: Response) { return await r.json(); }

describe("opd/maternity/delivery-close", () => {
  it("sets status=delivered and end_date", async () => {
    const { client, db } = seed("active");
    const res = await handlePOST({ body: { episode_id: "ep1", end_date: "2026-07-09" }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.ok).toBe(true);
    expect(r.data.status).toBe("delivered");
    expect(r.data.end_date).toBe("2026-07-09");
    expect((db.tables.episode_of_care[0] as any).status).toBe("delivered");
  });

  it("idempotent — already-delivered returns same row", async () => {
    const { client } = seed("delivered", "2026-07-01");
    const res = await handlePOST({ body: { episode_id: "ep1" }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.data.status).toBe("delivered");
    expect(r.data.end_date).toBe("2026-07-01");
  });

  it("rejects non-pregnancy episode", async () => {
    const { client } = makeMockDb({
      tables: { episode_of_care: [{ id: "ep1", tenant_id: T, status: "active", care_type: "chronic" }] },
    });
    const res = await handlePOST({ body: { episode_id: "ep1" }, ctx: CTX, db: client });
    expect(res.status).toBe(400);
  });
});