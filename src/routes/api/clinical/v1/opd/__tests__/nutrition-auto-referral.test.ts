// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handleGET } from "../opd.nutrition.referrals.pending";
import { makeMockDb } from "@/test/db-mock";

const T = "t1";
const CTX = { tenantId: T, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed(rows: Record<string, unknown>[]) {
  return makeMockDb({ tables: { referral: rows } });
}

async function j(r: Response) { return await r.json(); }

describe("opd/nutrition/referrals/pending — auto-generated drafts", () => {
  it("returns only rows with source_key like nutrition_screen:%", async () => {
    const { client } = seed([
      { id: "r1", tenant_id: T, referral_no: "REF-A", source_key: "nutrition_screen:e1", status: "draft", source_encounter_id: "e1", beneficiary_id: "b1", reason: "nutrition_high_risk_pregnancy", created_at: "2026-07-01" },
      { id: "r2", tenant_id: T, referral_no: "REF-B", source_key: null, status: "draft", source_encounter_id: "e2", beneficiary_id: "b2", reason: "manual", created_at: "2026-07-02" },
      { id: "r3", tenant_id: T, referral_no: "REF-C", source_key: "other:xxx", status: "draft", source_encounter_id: "e3", beneficiary_id: "b3", reason: null, created_at: "2026-07-03" },
    ]);
    const res = await handleGET({ query: { encounter_id: null }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.ok).toBe(true);
    expect(r.data.rows.map((x: any) => x.id)).toEqual(["r1"]);
  });

  it("filters out terminal status (accepted/completed)", async () => {
    const { client } = seed([
      { id: "r1", tenant_id: T, referral_no: "A", source_key: "nutrition_screen:e1", status: "completed", source_encounter_id: "e1", beneficiary_id: "b1", reason: "x", created_at: "2026-07-01" },
      { id: "r2", tenant_id: T, referral_no: "B", source_key: "nutrition_screen:e2", status: "draft",     source_encounter_id: "e2", beneficiary_id: "b2", reason: "x", created_at: "2026-07-02" },
    ]);
    const res = await handleGET({ query: { encounter_id: null }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.data.rows.map((x: any) => x.id)).toEqual(["r2"]);
  });

  it("scopes to a single encounter when encounter_id passed", async () => {
    const { client } = seed([
      { id: "r1", tenant_id: T, referral_no: "A", source_key: "nutrition_screen:e1", status: "draft", source_encounter_id: "e1", beneficiary_id: "b1", reason: "x", created_at: "2026-07-01" },
      { id: "r2", tenant_id: T, referral_no: "B", source_key: "nutrition_screen:e2", status: "draft", source_encounter_id: "e2", beneficiary_id: "b2", reason: "x", created_at: "2026-07-02" },
    ]);
    const res = await handleGET({ query: { encounter_id: "e2" }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.data.rows.map((x: any) => x.id)).toEqual(["r2"]);
  });

  it("tenant isolation", async () => {
    const { client } = seed([
      { id: "r1", tenant_id: "other", referral_no: "A", source_key: "nutrition_screen:e1", status: "draft", source_encounter_id: "e1", beneficiary_id: "b1", reason: "x", created_at: "2026-07-01" },
    ]);
    const res = await handleGET({ query: { encounter_id: null }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.data.rows).toEqual([]);
  });

  it("empty when nothing seeded (idempotent shape)", async () => {
    const { client } = seed([]);
    const res = await handleGET({ query: { encounter_id: null }, ctx: CTX, db: client });
    const r = await j(res);
    expect(r.ok).toBe(true);
    expect(r.data.rows).toEqual([]);
  });
});