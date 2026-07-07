/**
 * Step 3 Turn 1 · Referral rule engine fixtures.
 *
 * Covers:
 *   1  Rule A · cross-specialty referral triggers pre-auth + new_consult
 *   2  Rule B · day-14 → follow_up (operator {op:'lte',value:14})
 *   3  Rule B · day-15 → does NOT match (boundary)
 *   4  Rule C · MRP-shift with series_therapy sub_category → 'series'
 *   5  Rule C · MRP-shift without series flag → 'no_charge'
 *   6  matches() flat-equality backward compatibility (existing PBM payload shape)
 *   7  BB2 · foldTriggerOutcome resolver reads facts.sub_category
 */
// @ts-expect-error — bun-types conflict, mirrors billed-gate.test.ts pattern.
import { describe, expect, it } from "bun:test";
import { evaluateTriggers, foldTriggerOutcome, type TriggerHit } from "./rules";

type Rule = Parameters<typeof evaluateTriggers>[0][number];

const RULE_A: Rule = {
  id: "rule-A",
  name: "Rule A Cross-specialty referral",
  scope: "referral",
  priority: 10,
  condition: { target_specialty_differs: true },
  action: { code: "REF_NEW_CONSULT", charge_mode: "new_consult", preauth_required: true },
  tenant_id: null,
  active: true,
} as unknown as Rule;

const RULE_B: Rule = {
  id: "rule-B",
  name: "Rule B Same-specialty follow-up",
  scope: "referral",
  priority: 20,
  condition: {
    target_specialty_differs: false,
    days_since_last_visit: { op: "lte", value: 14 },
  },
  action: { code: "REF_FOLLOW_UP", charge_mode: "follow_up", preauth_required: false },
  tenant_id: null,
  active: true,
} as unknown as Rule;

const RULE_C: Rule = {
  id: "rule-C",
  name: "Rule C 14-day lapse / MRP shift",
  scope: "referral",
  priority: 30,
  condition: { days_since_last_visit: { op: "gte", value: 15 } },
  action: {
    code: "REF_SERIES",
    series_sub_category: "series_therapy",
    charge_mode_resolver: "series_or_no_charge",
  },
  tenant_id: null,
  active: true,
} as unknown as Rule;

const PBM_RULE: Rule = {
  id: "rule-pbm-flat",
  name: "PBM indication required (flat equality)",
  scope: "pbm",
  priority: 10,
  condition: { pricing_mode: "insured" },
  action: { preauth_required: true, code: "PBM_INDICATION_REQUIRED" },
  tenant_id: null,
  active: true,
} as unknown as Rule;

const RULES = [RULE_A, RULE_B, RULE_C];

describe("Step 3 · referral rule engine (AA2 + AA3 + BB1 + BB2)", () => {
  it("1 · Rule A · cross-specialty triggers preauth + new_consult", () => {
    const facts = { target_specialty_differs: true } as never;
    const hits = evaluateTriggers(RULES, facts, "referral");
    expect(hits.map((h) => h.rule_id)).toEqual(["rule-A"]);
    expect(foldTriggerOutcome(hits)).toEqual({
      preauth_required: true,
      charge_mode: "new_consult",
      discount: null,
      eligibility_check_required: false,
      block_reason: null,
    });
  });

  it("2 · Rule B · day-14 matches → follow_up", () => {
    const facts = { target_specialty_differs: false, days_since_last_visit: 14 } as never;
    const hits = evaluateTriggers(RULES, facts, "referral");
    expect(hits.map((h) => h.rule_id)).toEqual(["rule-B"]);
    expect(foldTriggerOutcome(hits).charge_mode).toBe("follow_up");
  });

  it("3 · Rule B · day-15 does NOT match (boundary lte:14)", () => {
    const facts = { target_specialty_differs: false, days_since_last_visit: 15 } as never;
    const hits = evaluateTriggers([RULE_B], facts, "referral");
    expect(hits).toEqual([]);
  });

  it("4 · Rule C · days>=15 + sub_category='series_therapy' → 'series'", () => {
    const facts = { days_since_last_visit: 20 } as never;
    const hits = evaluateTriggers(RULES, facts, "referral");
    expect(hits.map((h) => h.rule_id)).toEqual(["rule-C"]);
    expect(foldTriggerOutcome(hits, { sub_category: "series_therapy" }).charge_mode).toBe("series");
  });

  it("5 · Rule C · days>=15 without series flag → 'no_charge'", () => {
    const facts = { days_since_last_visit: 42 } as never;
    const hits = evaluateTriggers(RULES, facts, "referral");
    expect(foldTriggerOutcome(hits, { sub_category: null }).charge_mode).toBe("no_charge");
  });

  it("6 · flat-equality payload (PBM) still matches — backward compat", () => {
    const facts = { pricing_mode: "insured" } as never;
    const hits = evaluateTriggers([PBM_RULE], facts, "pbm");
    expect(hits.map((h) => h.rule_id)).toEqual(["rule-pbm-flat"]);
  });

  it("7 · BB2 · foldTriggerOutcome reads facts.sub_category for series resolver", () => {
    const hit: TriggerHit = {
      rule_id: "rule-C",
      name: "Rule C",
      scope: "referral",
      priority: 30,
      action: { charge_mode_resolver: "series_or_no_charge", series_sub_category: "series_therapy" },
      code: "REF_SERIES",
    };
    expect(foldTriggerOutcome([hit], { sub_category: "series_therapy" }).charge_mode).toBe("series");
    expect(foldTriggerOutcome([hit], { sub_category: "other" }).charge_mode).toBe("no_charge");
    expect(foldTriggerOutcome([hit]).charge_mode).toBe("no_charge");
  });
});