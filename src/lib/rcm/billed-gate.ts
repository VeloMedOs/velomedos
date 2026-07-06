/**
 * Step 1 · TypeScript mirror of `public.charge_is_billed()` (SQL, M07 + M15).
 *
 * The SQL predicate remains the enforcing gate — this mirror is used for:
 *   1. gate/preview API responses (explain-why),
 *   2. worklist row hints without an extra round-trip,
 *   3. fixture-parity unit tests that guard against future drift.
 *
 * Semantics must track M15 exactly:
 *   D1 — refund re-lock via deposit lineage (refund_request → deposit →
 *        encounter/admission).
 *   D2 — IMP class OR active day_case admission routes through
 *        admission_gate_open(); drg_bundled charges included.
 *   D3 — admission gate = releasing exception OR (insured⇒auth approved) AND
 *        deposit >= max(requested, estimated * ip_deposit_min_percent/100).
 *   D4 — self-pay uses cumulative committed cash charges (this + already-past-
 *        gate rows) vs (posted cash + wallet).
 */

import type { Database } from "@/integrations/supabase/types";

type ChargeItem = Database["public"]["Tables"]["charge_item"]["Row"];
type Encounter = Database["public"]["Tables"]["encounter"]["Row"];
type AdmissionRequest = Database["public"]["Tables"]["admission_request"]["Row"];
type RefundRequest = Database["public"]["Tables"]["refund_request"]["Row"];
type Deposit = Database["public"]["Tables"]["deposit"]["Row"];
type CashCollection = Database["public"]["Tables"]["cash_collection"]["Row"];
type AuthItem = Database["public"]["Tables"]["authorization_item"]["Row"];
type RcmException = Database["public"]["Tables"]["rcm_gate_exception"]["Row"];

/** The set of charge_item statuses that count as "past the gate" for D4. */
export const PAST_GATE_CASH_STATUSES = new Set([
  "collected",
  "in_progress",
  "resulted",
  "dispensed",
]);

/** Exception types that release a per-charge gate. */
export const RELEASING_EXCEPTION_TYPES = new Set([
  "emergency_override",
  "partial_deposit_override",
  "installment_override",
  "clinical_urgency",
  "mrp_verbal_order",
  "newborn_inherit",
  "ineligibility_workflow",
  "config_no_auth",
  "admin_override",
]);

/** Exception types that release an admission gate. */
export const RELEASING_ADMISSION_EXCEPTION_TYPES = new Set([
  "emergency_override",
  "partial_deposit_override",
  "installment_override",
  "clinical_urgency",
  "admin_override",
  "ineligibility_workflow",
]);

export type BilledGateFacts = {
  charge: ChargeItem;
  encounter: Pick<Encounter, "id" | "class" | "beneficiary_id">;
  admission?: Pick<AdmissionRequest, "id" | "status" | "request_type" | "coverage_id"
    | "requested_deposit_minor" | "paid_amount_minor"> & {
      estimated_charges_minor?: number | null;
    } | null;
  refunds: Array<Pick<RefundRequest, "id" | "tenant_id" | "status" | "deposit_id">>;
  deposits: Array<Pick<Deposit, "id" | "encounter_id" | "admission_request_id">>;
  cashCollections: Array<Pick<CashCollection, "status" | "net_collected_minor" | "beneficiary_id" | "claim_id">>;
  chargeItemsForEncounter: Array<Pick<ChargeItem, "id" | "encounter_id" | "pricing_mode" | "status" | "net_minor">>;
  claimsForEncounter: Array<{ id: string; encounter_id: string | null }>;
  authItems: Array<Pick<AuthItem, "charge_item_id" | "decision">>;
  admissionAuthApproved: boolean;
  exceptions: Array<Pick<RcmException, "charge_item_id" | "encounter_id" | "admission_request_id"
    | "closed_at" | "expires_at" | "exception_type">>;
  walletBalanceMinor: number;
  /** Order-item flag (parent order.preauth_required). */
  orderItemPreauthRequired: boolean;
  serviceMasterPreauthRequired: boolean;
  drugMasterPreauthRequired: boolean;
  ipDepositMinPercent: number;
  now?: Date;
};

export type BilledGateOutcome =
  | { billed: true; via: "release" | "admission_gate" | "insured_auth" | "self_pay_cumulative" }
  | { billed: false; reason:
      | "cancelled"
      | "refund_relock"
      | "no_admission"
      | "admission_gate_closed"
      | "auth_missing"
      | "wallet_negative"
      | "self_pay_insufficient"
      | "unknown_pricing_mode" };

function isActive(e: BilledGateFacts["exceptions"][number], now: number): boolean {
  if (e.closed_at) return false;
  if (e.expires_at && new Date(e.expires_at).getTime() <= now) return false;
  return true;
}

/** SQL parity: public.admission_gate_open(_admission_id). */
export function admissionGateOpen(
  admission: NonNullable<BilledGateFacts["admission"]>,
  facts: Pick<BilledGateFacts, "exceptions" | "ipDepositMinPercent" | "admissionAuthApproved">,
  now: number,
): boolean {
  const releasing = facts.exceptions.some(
    (e) => e.admission_request_id === admission.id
      && RELEASING_ADMISSION_EXCEPTION_TYPES.has(e.exception_type)
      && isActive(e, now),
  );
  if (releasing) return true;

  if (admission.coverage_id && !facts.admissionAuthApproved) return false;

  const pct = Number.isFinite(facts.ipDepositMinPercent) ? facts.ipDepositMinPercent : 35;
  const required = Math.max(
    admission.requested_deposit_minor ?? 0,
    Math.floor(((admission.estimated_charges_minor ?? 0) * pct) / 100),
  );
  return (admission.paid_amount_minor ?? 0) >= required;
}

/** SQL parity: public.charge_is_billed(_tbl, _id). */
export function chargeIsBilled(f: BilledGateFacts): BilledGateOutcome {
  const now = (f.now ?? new Date()).getTime();
  const c = f.charge;

  if (c.status === "cancelled") return { billed: false, reason: "cancelled" };

  // Releasing exceptions on the charge or encounter.
  const chargeReleased = f.exceptions.some(
    (e) => (e.charge_item_id === c.id || (e.encounter_id && e.encounter_id === c.encounter_id))
      && RELEASING_EXCEPTION_TYPES.has(e.exception_type)
      && isActive(e, now),
  );
  if (chargeReleased) return { billed: true, via: "release" };

  // D1 · Scoped refund re-lock via deposit lineage.
  const admissionIdsForEnc = new Set(
    (f.admission?.id && f.admission.id !== null ? [f.admission.id] : []),
  );
  const relockedDepositIds = new Set(
    f.deposits
      .filter((d) => d.encounter_id === c.encounter_id
        || (d.admission_request_id && admissionIdsForEnc.has(d.admission_request_id)))
      .map((d) => d.id),
  );
  const hasRelock = f.refunds.some(
    (r) => r.tenant_id === c.tenant_id
      && (r.status === "approved" || r.status === "executed")
      && r.deposit_id && relockedDepositIds.has(r.deposit_id),
  );
  if (hasRelock) return { billed: false, reason: "refund_relock" };

  // D2 · Encounter-class branch.
  const isDayCase = f.admission?.request_type === "day_case"
    && f.admission.status !== "cancelled";
  if (f.encounter.class === "IMP" || isDayCase) {
    if (!f.admission) return { billed: false, reason: "no_admission" };
    if (!admissionGateOpen(f.admission, f, now)) {
      return { billed: false, reason: "admission_gate_closed" };
    }
    const needsAuth = f.orderItemPreauthRequired
      || f.serviceMasterPreauthRequired
      || f.drugMasterPreauthRequired;
    if (needsAuth) {
      const ok = f.authItems.some(
        (ai) => ai.charge_item_id === c.id && (ai.decision === "approved" || ai.decision === "partial"),
      );
      return ok
        ? { billed: true, via: "insured_auth" }
        : { billed: false, reason: "auth_missing" };
    }
    return { billed: true, via: "admission_gate" };
  }

  // AMB / EMER / HH / VR fall-through.
  if (c.pricing_mode === "insured") {
    const ok = f.authItems.some(
      (ai) => ai.charge_item_id === c.id && (ai.decision === "approved" || ai.decision === "partial"),
    );
    return ok
      ? { billed: true, via: "insured_auth" }
      : { billed: false, reason: "auth_missing" };
  }

  if (c.pricing_mode === "cash") {
    if (f.walletBalanceMinor < 0) return { billed: false, reason: "wallet_negative" };

    const claimIds = new Set(
      f.claimsForEncounter.filter((cl) => cl.encounter_id === c.encounter_id).map((cl) => cl.id),
    );
    const paid = f.cashCollections
      .filter((cc) => cc.status === "posted"
        && ((cc.claim_id && claimIds.has(cc.claim_id))
          || cc.beneficiary_id === f.encounter.beneficiary_id))
      .reduce((s, cc) => s + (cc.net_collected_minor ?? 0), 0);

    const committed = f.chargeItemsForEncounter
      .filter((ci) => ci.encounter_id === c.encounter_id
        && ci.pricing_mode === "cash"
        && ci.status !== "cancelled"
        && (ci.id === c.id || (ci.status && PAST_GATE_CASH_STATUSES.has(ci.status))))
      .reduce((s, ci) => s + (ci.net_minor ?? 0), 0);

    return committed <= paid + f.walletBalanceMinor
      ? { billed: true, via: "self_pay_cumulative" }
      : { billed: false, reason: "self_pay_insufficient" };
  }

  return { billed: false, reason: "unknown_pricing_mode" };
}