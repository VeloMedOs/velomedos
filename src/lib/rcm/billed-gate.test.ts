/**
 * SQL/TS parity fixtures for public.charge_is_billed / chargeIsBilled.
 * Runs under `bun test`.
 *
 * Six scenarios covering M07+M15+M16 semantics — D2 admission gate for
 * drg_bundled and day_case, D4 cumulative self-pay, D1 refund lineage,
 * D5 encounter-scoped cash reducer (regression guard), and one
 * foldTriggerOutcome contract check for Rule A.
 */
// @ts-expect-error — bun-types conflicts with @supabase/supabase-js fetch typing
// in this project's global scope, so we import bun:test without types. The test
// runs under `bun test`; type-checking of this file is not required for the build.
import { describe, expect, it } from "bun:test";
import { chargeIsBilled, type BilledGateFacts } from "./billed-gate";
import { foldTriggerOutcome, type TriggerHit } from "@/lib/mds/rules";

const TENANT = "00000000-0000-0000-0000-000000000001";
const ENC = "00000000-0000-0000-0000-0000000000e1";
const ENC_OTHER = "00000000-0000-0000-0000-0000000000e2";
const BEN = "00000000-0000-0000-0000-0000000000b1";
const ADM = "00000000-0000-0000-0000-0000000000a1";

/** Minimal builder — every field the predicate touches, defaults tuned so
 *  cash-path evaluation has enough state to reach the reducer. */
function baseFacts(overrides: Partial<BilledGateFacts> = {}): BilledGateFacts {
  const charge = {
    id: "c1",
    tenant_id: TENANT,
    encounter_id: ENC,
    status: "ordered",
    pricing_mode: "cash",
    net_minor: 100,
    order_item_table: "lab_order_item",
    order_item_id: "oi1",
    service_id: null,
    drug_id: null,
  } as unknown as BilledGateFacts["charge"];
  return {
    charge,
    encounter: { id: ENC, class: "AMB", beneficiary_id: BEN },
    admission: null,
    refunds: [],
    deposits: [],
    cashCollections: [],
    chargeItemsForEncounter: [],
    claimsForEncounter: [],
    authItems: [],
    admissionAuthApproved: false,
    exceptions: [],
    walletBalanceMinor: 0,
    orderItemPreauthRequired: false,
    serviceMasterPreauthRequired: false,
    drugMasterPreauthRequired: false,
    ipDepositMinPercent: 35,
    admissionIdsForEncounter: [],
    ...overrides,
  };
}

describe("chargeIsBilled — parity fixtures", () => {
  it("1 · IMP + drg_bundled, admission gate open → admission_gate", () => {
    const f = baseFacts({
      charge: { ...baseFacts().charge, pricing_mode: "drg_bundled", net_minor: 5000 } as never,
      encounter: { id: ENC, class: "IMP", beneficiary_id: BEN },
      admission: {
        id: ADM, status: "admitted", request_type: "elective_ip", coverage_id: null,
        requested_deposit_minor: 0, paid_amount_minor: 0, estimated_charges_minor: 0,
      } as never,
      admissionIdsForEncounter: [ADM],
    });
    expect(chargeIsBilled(f)).toEqual({ billed: true, via: "admission_gate" });
  });

  it("2 · AMB encounter with active day_case admission → routes via admission gate", () => {
    const f = baseFacts({
      charge: { ...baseFacts().charge, pricing_mode: "insured" } as never,
      encounter: { id: ENC, class: "AMB", beneficiary_id: BEN },
      admission: {
        id: ADM, status: "admitted", request_type: "day_case", coverage_id: null,
        requested_deposit_minor: 0, paid_amount_minor: 0, estimated_charges_minor: 0,
      } as never,
      admissionIdsForEncounter: [ADM],
    });
    expect(chargeIsBilled(f)).toEqual({ billed: true, via: "admission_gate" });
  });

  it("3 · Self-pay cumulative: 1 payment of 100 covers only the first of three 100-orders", () => {
    const collections = [{ status: "posted", net_collected_minor: 100, encounter_id: ENC, claim_id: null }];
    const orderA = { id: "A", encounter_id: ENC, pricing_mode: "cash", status: "ordered", net_minor: 100 };
    const orderB = { id: "B", encounter_id: ENC, pricing_mode: "cash", status: "collected", net_minor: 100 };
    const orderC = { id: "C", encounter_id: ENC, pricing_mode: "cash", status: "ordered", net_minor: 100 };

    // Evaluate A while B already past-gate: committed = A + B = 200 > paid 100 → insufficient.
    const evalA = baseFacts({
      charge: { ...baseFacts().charge, id: "A" } as never,
      cashCollections: collections as never,
      chargeItemsForEncounter: [orderA, orderB, orderC] as never,
    });
    expect(chargeIsBilled(evalA)).toEqual({ billed: false, reason: "self_pay_insufficient" });

    // With no siblings yet past-gate: committed = A = 100 ≤ paid 100 → billed.
    const evalAAlone = baseFacts({
      charge: { ...baseFacts().charge, id: "A" } as never,
      cashCollections: collections as never,
      chargeItemsForEncounter: [{ ...orderA }] as never,
    });
    expect(chargeIsBilled(evalAAlone)).toEqual({ billed: true, via: "self_pay_cumulative" });
  });

  it("4 · Approved refund on encounter admission's deposit → refund_relock", () => {
    const f = baseFacts({
      refunds: [{ id: "r1", tenant_id: TENANT, status: "approved", deposit_id: "d1" }] as never,
      deposits: [{ id: "d1", encounter_id: null, admission_request_id: ADM }] as never,
      admissionIdsForEncounter: [ADM],
    });
    expect(chargeIsBilled(f)).toEqual({ billed: false, reason: "refund_relock" });
  });

  it("5 · D5 regression guard — cross-encounter cash + voided posted row do NOT release", () => {
    const f = baseFacts({
      cashCollections: [
        // Payment on a DIFFERENT encounter of the same patient — must not count.
        { status: "posted", net_collected_minor: 500, encounter_id: ENC_OTHER, claim_id: null },
        // Voided row on the correct encounter — status filter excludes it.
        { status: "voided", net_collected_minor: 500, encounter_id: ENC, claim_id: null },
      ] as never,
      chargeItemsForEncounter: [
        { id: "c1", encounter_id: ENC, pricing_mode: "cash", status: "ordered", net_minor: 100 },
      ] as never,
    });
    expect(chargeIsBilled(f)).toEqual({ billed: false, reason: "self_pay_insufficient" });
  });
});

describe("foldTriggerOutcome — Rule A", () => {
  it("6 · cross-specialty hit folds to preauth + new_consult, no block", () => {
    const hits: TriggerHit[] = [{
      rule_id: "ruleA",
      name: "Rule A Cross-specialty referral",
      scope: "referral",
      priority: 10,
      action: { preauth_required: true, charge_mode: "new_consult", code: "REF_NEW_CONSULT" },
      code: "REF_NEW_CONSULT",
    }];
    expect(foldTriggerOutcome(hits)).toEqual({
      preauth_required: true,
      charge_mode: "new_consult",
      discount: null,
      eligibility_check_required: false,
      block_reason: null,
    });
  });

  it("7 · scope='pbm' hit with preauth_required folds to the five-field contract", () => {
    // X6 · Part-0 leftover — PBM fold parity fixture (spec 05 §5A tie-in).
    const hits: TriggerHit[] = [{
      rule_id: "rulePBM",
      name: "R-PBM2b · indication required",
      scope: "pbm",
      priority: 20,
      action: { preauth_required: true, code: "PBM_INDICATION_REQUIRED" },
      code: "PBM_INDICATION_REQUIRED",
    }];
    expect(foldTriggerOutcome(hits)).toEqual({
      preauth_required: true,
      charge_mode: null,
      discount: null,
      eligibility_check_required: false,
      block_reason: null,
    });
  });
});