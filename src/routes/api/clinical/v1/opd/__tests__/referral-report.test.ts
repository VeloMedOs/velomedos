// @ts-expect-error bun-types conflicts with supabase-js fetch typing
import { describe, expect, it } from "bun:test";
import { fetchReport, handleGET as reportGET } from "../opd.referral.report";
import { handleGET as reportCsvGET } from "../opd.referral.report.csv";
import { makeMockDb } from "@/test/db-mock";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TENANT = "t1";
const CTX = { tenantId: TENANT, userId: "u1", clinicalRole: "physician" as const };

function seed() {
  const referrals = [
    { id: "r1", tenant_id: TENANT, referral_no: "R-1", source_specialty: "gp", referral_class: "intra",         status: "submitted", reason: null,             source_key: null,               charge_mode: "follow_up",   preauth_required: false, series_id: null, created_at: "2026-06-15T09:00:00Z" },
    { id: "r2", tenant_id: TENANT, referral_no: "R-2", source_specialty: "gp", referral_class: "cross_encounter", status: "submitted", reason: "auto",           source_key: "nutrition_screen:e1", charge_mode: null,          preauth_required: false, series_id: null, created_at: "2026-06-16T09:00:00Z" },
    { id: "r3", tenant_id: TENANT, referral_no: "R-3", source_specialty: "cardio", referral_class: "external",   status: "submitted", reason: "network absent", source_key: null,               charge_mode: null,          preauth_required: true,  series_id: null, created_at: "2026-06-17T09:00:00Z" },
    { id: "r4", tenant_id: TENANT, referral_no: "R-4", source_specialty: "gp",  referral_class: "inter_company", status: "submitted", reason: null,             source_key: null,               charge_mode: "new_consult", preauth_required: false, series_id: null, created_at: "2026-06-18T09:00:00Z" },
    { id: "rX", tenant_id: "other", referral_no: "R-X", source_specialty: "gp", referral_class: "intra",         status: "submitted", reason: null,             source_key: null,               charge_mode: null,          preauth_required: false, series_id: null, created_at: "2026-06-18T09:00:00Z" },
  ];
  const targets = [
    { id: "t1", referral_id: "r1", tenant_id: TENANT, target_kind: "specialty",        target_specialty: "cardio",    target_facility_id: null,  status: "accepted",  created_at: "2026-06-15T09:00:00Z", updated_at: "2026-06-15T13:00:00Z" }, // 4h
    { id: "t2", referral_id: "r2", tenant_id: TENANT, target_kind: "specialty",        target_specialty: "nutrition", target_facility_id: null,  status: "declined",  created_at: "2026-06-16T09:00:00Z", updated_at: "2026-06-16T11:00:00Z" },
    { id: "t3", referral_id: "r3", tenant_id: TENANT, target_kind: "external_facility", target_specialty: null,        target_facility_id: null,  status: "draft",     created_at: "2026-06-17T09:00:00Z", updated_at: null },
    { id: "t4", referral_id: "r4", tenant_id: TENANT, target_kind: "entity",           target_specialty: "cardio",    target_facility_id: "t2",  status: "accepted",  created_at: "2026-06-18T09:00:00Z", updated_at: "2026-06-18T11:00:00Z" }, // 2h
    { id: "tX", referral_id: "rX", tenant_id: "other", target_kind: "specialty",        target_specialty: "cardio",    target_facility_id: null,  status: "accepted",  created_at: "2026-06-18T09:00:00Z", updated_at: "2026-06-18T09:30:00Z" },
  ];
  return makeMockDb({ tables: { referral: referrals, referral_target: targets } });
}

function search(overrides: Record<string, string> = {}) {
  const sp = new URLSearchParams({
    date_from: "2026-06-01T00:00:00Z",
    date_to:   "2026-06-30T23:59:59Z",
  });
  for (const [k, v] of Object.entries(overrides)) sp.set(k, v);
  return sp;
}

describe("Step 5 · Turn 3 — Referral report (HCA-1010)", () => {
  it("aggregates volumes, acceptance rate, and mean TAT over the window", async () => {
    const { client } = seed();
    const res = await reportGET({ ctx: CTX, search: search(), db: client });
    const j = await res.json();
    expect(j.data.totals.rows).toBe(4); // 4 targets, cross-tenant excluded
    expect(j.data.totals.referrals).toBe(4);
    expect(j.data.totals.accepted).toBe(2);
    expect(j.data.totals.declined).toBe(1);
    // Acceptance = accepted / (accepted+declined+cancelled+completed) = 2/3
    expect(j.data.acceptance_rate).toBeCloseTo(2 / 3, 2);
    // Mean TAT over decided-out-of-draft rows: (4 + 2 + 2)/3 = ~2.7h
    expect(j.data.tat.mean_hours).toBeCloseTo(2.7, 1);
  });

  it("partitions cluster scope (own vs sibling vs external)", async () => {
    const { client } = seed();
    const res = await reportGET({ ctx: CTX, search: search(), db: client });
    const j = await res.json();
    expect(j.data.cluster_split.own).toBe(2);      // r1 intra, r2 cross_encounter
    expect(j.data.cluster_split.sibling).toBe(1);  // r4 inter_company
    expect(j.data.cluster_split.external).toBe(1); // r3 external
  });

  it("sorts decline reasons descending", async () => {
    const { client } = seed();
    // add another declined
    const r = await fetchReport({ ctx: CTX, search: search(), db: client });
    if (!r.ok) throw new Error("fetch failed");
    const rr = r.summary.decline_reasons;
    if (rr.length > 1) {
      for (let i = 1; i < rr.length; i++) expect(rr[i - 1].count >= rr[i].count).toBe(true);
    }
    expect(rr[0]?.reason).toBe("auto");
  });

  it("flags truncated when scan cap is hit", async () => {
    const bulk = Array.from({ length: 5001 }).map((_, i) => ({
      id: `b${i}`, tenant_id: TENANT, referral_no: `B-${i}`, source_specialty: "gp",
      referral_class: "intra", status: "draft", reason: null, source_key: null,
      charge_mode: null, preauth_required: false, series_id: null,
      created_at: "2026-06-15T09:00:00Z",
    }));
    const { client } = makeMockDb({ tables: { referral: bulk, referral_target: [] } });
    const res = await reportGET({ ctx: CTX, search: search(), db: client });
    const j = await res.json();
    expect(j.data.truncated).toBe(true);
  });

  it("CSV endpoint: attachment header, row count parity with JSON totals.rows", async () => {
    const { client } = seed();
    const csvRes = await reportCsvGET({ ctx: CTX, search: search(), db: client });
    expect(csvRes.headers.get("content-type")).toMatch(/text\/csv/);
    expect(csvRes.headers.get("content-disposition") ?? "").toMatch(/referral-report-\d{8}-\d{8}\.csv/);
    const text = await csvRes.text();
    const lines = text.trim().split("\n");
    const dataLines = lines.length - 1; // subtract header
    const jsonRes = await reportGET({ ctx: CTX, search: search(), db: client });
    const j = await jsonRes.json();
    expect(dataLines).toBe(j.data.totals.rows);
  });

  it("cross-tenant referrals excluded from own-tenant report", async () => {
    const { client } = seed();
    const res = await reportGET({ ctx: CTX, search: search(), db: client });
    const j = await res.json();
    // rX under tenant 'other' contributes neither a row nor a referral count.
    expect(j.data.totals.rows).toBe(4);
    expect(j.data.totals.referrals).toBe(4);
  });
});