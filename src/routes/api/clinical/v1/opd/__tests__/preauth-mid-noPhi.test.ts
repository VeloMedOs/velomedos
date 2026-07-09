// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../../../public/v1/preauth-mid.board";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "11111111-1111-1111-1111-111111111111";

function db(rows: any[]) {
  return makeMockDb({
    tables: {
      corporate_accounts: [{ id: TENANT, slug: "acme" }],
    },
    rpc: (name, args) => {
      if (name !== "preauth_mid_board") return null;
      if ((args as any)._tenant !== TENANT) return [];
      return rows;
    },
  }).client;
}

describe("public/preauth-mid — no PHI, five-color mapping", () => {
  it("omits beneficiary/encounter/full ref from response", async () => {
    const rows = [{
      id: "a1", tenant_id: TENANT, masked_ref: "***-345", status: "submitted",
      status_color: "amber", decision_at: null, valid_to: null, priority: "normal",
      updated_at: "2026-07-09T10:00:00Z",
      // Fields that MUST be stripped:
      beneficiary_id: "leaked", encounter_id: "leaked", preauth_ref: "ABC12345", notes: "PHI",
    }];
    const res = await handleGET({ query: { tenant: TENANT }, db: db(rows) });
    const j = await res.json();
    const r0 = j.rows[0];
    expect(r0.masked_ref).toBe("***-345");
    expect(r0).not.toHaveProperty("beneficiary_id");
    expect(r0).not.toHaveProperty("encounter_id");
    expect(r0).not.toHaveProperty("preauth_ref");
    expect(r0).not.toHaveProperty("notes");
  });

  it("preserves the five File-14 status colors on the wire", async () => {
    const rows = [
      { id: "1", tenant_id: TENANT, masked_ref: null, status: "new",                status_color: "white", updated_at: "2026-07-09T10:00:00Z" },
      { id: "2", tenant_id: TENANT, masked_ref: null, status: "submitted",          status_color: "amber", updated_at: "2026-07-09T10:00:00Z" },
      { id: "3", tenant_id: TENANT, masked_ref: null, status: "approved",           status_color: "green", updated_at: "2026-07-09T10:00:00Z" },
      { id: "4", tenant_id: TENANT, masked_ref: null, status: "partially_approved", status_color: "teal",  updated_at: "2026-07-09T10:00:00Z" },
      { id: "5", tenant_id: TENANT, masked_ref: null, status: "rejected",           status_color: "red",   updated_at: "2026-07-09T10:00:00Z" },
    ];
    const res = await handleGET({ query: { tenant: TENANT }, db: db(rows) });
    const j = await res.json();
    const map = Object.fromEntries(j.rows.map((r: any) => [r.status, r.status_color]));
    expect(map.new).toBe("white");
    expect(map.submitted).toBe("amber");
    expect(map.approved).toBe("green");
    expect(map.partially_approved).toBe("teal");
    expect(map.rejected).toBe("red");
  });

  it("unknown tenant → empty rows (no enumeration signal)", async () => {
    const res = await handleGET({ query: { tenant: "not-a-real-tenant" }, db: db([]) });
    const j = await res.json();
    expect(j.rows).toEqual([]);
  });
});