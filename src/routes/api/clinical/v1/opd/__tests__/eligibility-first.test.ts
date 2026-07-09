// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { handlePOST, type EligibilityFirstBody } from "../opd.registration.eligibility-first";
import { makeMockDb } from "@/test/db-mock";

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "tenant_admin" as const };

function seed(over: { beneficiary?: Record<string, unknown>; coverage?: Record<string, unknown> | null } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    beneficiary: [{ id: "b1", tenant_id: TENANT, ...(over.beneficiary ?? {}) }],
    coverage: over.coverage === null ? [] : [{ id: "c1", tenant_id: TENANT, ...(over.coverage ?? {}) }],
  };
  return makeMockDb({ tables });
}

async function body(res: Response) { return await res.json(); }

describe("opd/registration/eligibility-first — JJ3 branches", () => {
  it("eligible insured → ok path=insured", async () => {
    const { client } = seed();
    const b: EligibilityFirstBody = { beneficiary_id: "b1", visit_type: "scheduled", financial_type: "insured", coverage_id: "c1" };
    const runCheckFn = (async () => ({ ok: true, row: { id: "elig-1" }, sandbox: true })) as never;
    const res = await handlePOST({ body: b, ctx: CTX, db: client, runCheckFn });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(j.data.path).toBe("insured");
  });

  it("self_pay → ok without calling eligibility", async () => {
    const { client } = seed();
    let called = false;
    const runCheckFn = (async () => { called = true; return { ok: true, row: null }; }) as never;
    const res = await handlePOST({
      body: { beneficiary_id: "b1", visit_type: "walk_in", financial_type: "self_pay" },
      ctx: CTX, db: client, runCheckFn,
    });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(j.data.path).toBe("self_pay");
    expect(called).toBe(false);
  });

  it("insured without coverage_id → 422 coverage_required, no eligibility call", async () => {
    const { client } = seed();
    let called = false;
    const runCheckFn = (async () => { called = true; return { ok: true, row: null }; }) as never;
    const res = await handlePOST({
      body: { beneficiary_id: "b1", visit_type: "scheduled", financial_type: "insured" },
      ctx: CTX, db: client, runCheckFn,
    });
    expect(res.status).toBe(422);
    const j = await body(res);
    expect(j.code).toBe("coverage_required");
    expect(called).toBe(false);
  });

  it("not-eligible + walk_in → 403 not_eligible", async () => {
    const { client } = seed();
    const runCheckFn = (async () => ({ ok: false, error: "payer_reject", code: "not_eligible" })) as never;
    const res = await handlePOST({
      body: { beneficiary_id: "b1", visit_type: "walk_in", financial_type: "insured", coverage_id: "c1" },
      ctx: CTX, db: client, runCheckFn,
    });
    expect(res.status).toBe(403);
    const j = await body(res);
    expect(j.code).toBe("not_eligible");
  });

  it("not-eligible + emergency → ok exception path", async () => {
    const { client } = seed();
    const runCheckFn = (async () => ({ ok: false, error: "payer_reject" })) as never;
    const res = await handlePOST({
      body: { beneficiary_id: "b1", visit_type: "emergency", financial_type: "insured", coverage_id: "c1" },
      ctx: CTX, db: client, runCheckFn,
    });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(j.data.path).toBe("exception");
    expect(j.data.exception).toBe("emergency");
  });

  it("not-eligible + referral → ok exception path", async () => {
    const { client } = seed();
    const runCheckFn = (async () => ({ ok: false, error: "payer_reject" })) as never;
    const res = await handlePOST({
      body: { beneficiary_id: "b1", visit_type: "referral", financial_type: "insured", coverage_id: "c1" },
      ctx: CTX, db: client, runCheckFn,
    });
    const j = await body(res);
    expect(j.ok).toBe(true);
    expect(j.data.path).toBe("exception");
    expect(j.data.exception).toBe("referral");
  });
});