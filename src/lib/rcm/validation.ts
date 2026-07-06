/**
 * Phase 10 — RCM readiness validator (light).
 *
 * Validates the subset of R1/R3/R5 rules supported by the current schema:
 *  - R1 Eligibility (insured): claim must reference a coverage and have a
 *    recent eligibility check (eligibility_checked_at + eligibility_response).
 *  - R3 Executed-only: every charge_item priced into the claim must be in an
 *    executed status (anything beyond `ordered`).
 *  - R5 Snapshot locked: totals projected onto the claim must agree with the
 *    sum of priced claim_item rows (snapshot integrity).
 *
 * R2 (auth), R4 (admission/discharge gates), R6 (deposits), R7 (cash/ZATCA)
 * are stubbed — they bind to tables that land in later RCM phases. Calls
 * here are no-ops until those tables exist.
 */
import type { ReadinessBundle } from "@/lib/mds/claim-loader";
import type { MissingItem } from "@/lib/mds/validation";

/**
 * R7 — cash / ZATCA blockers exposed as string constants so panes and
 * server handlers can raise the same codes.
 */
export const R7_BLOCKERS = {
  EXECUTED_ONLY:                "EXECUTED_ONLY",
  ELIGIBILITY_RECHECK_REQUIRED: "ELIGIBILITY_RECHECK_REQUIRED",
  SAME_METHOD_REFUND:           "SAME_METHOD_REFUND",
  VAT_REVERSAL_REQUIRED:        "VAT_REVERSAL_REQUIRED",
  SESSION_MUST_BALANCE:         "SESSION_MUST_BALANCE",
  ZATCA_STRUCTURE_INVALID:      "ZATCA_STRUCTURE_INVALID",
  METHOD_DETAIL_MISSING:        "METHOD_DETAIL_MISSING",
} as const;

/**
 * Step 1 — Billed Gate / Forms Gate / PBM / IP blocker codes. Kept as a
 * single source of truth so SQL error strings, API handlers, and UI
 * mapping tables agree.
 */
export const GATE_BLOCKERS = {
  GATE_BILLED:              "GATE_BILLED",
  INDICATION_MISSING:       "INDICATION_MISSING",
  IP_DEPOSIT_INSUFFICIENT:  "IP_DEPOSIT_INSUFFICIENT",
  EMERGENCY_UNRECONCILED:   "EMERGENCY_UNRECONCILED",
  FORM_REQUIRED:            "FORM_REQUIRED",
} as const;

export type RcmReadiness = {
  ok: boolean;
  missing: MissingItem[];
  flags: {
    eligibility_ok: boolean;
    eligibility_lifecycle_ok: boolean;
    executed_only_ok: boolean;
    snapshot_locked: boolean;
    auth_ok: boolean;
  };
};

const EXECUTED_STATES = new Set([
  "collected",
  "in_progress",
  "resulted",
  "dispensed",
  "completed",
]);

function add(
  missing: MissingItem[],
  code: string,
  category: string,
  message: string,
  severity: MissingItem["severity"] = "error",
) {
  missing.push({ code, category, stage: "rcm", message, severity });
}

export function validateClaimRcmReadiness(b: ReadinessBundle): RcmReadiness {
  const missing: MissingItem[] = [];
  const claim = b.claim ?? {};
  const flags = {
    eligibility_ok: true,
    eligibility_lifecycle_ok: true,
    executed_only_ok: true,
    snapshot_locked: true,
    auth_ok: true,
  };

  // R1 — eligibility for insured / DRG-bundled claims
  const isCash = String(claim.billing_model ?? "") === "" || String(claim.claim_type ?? "").toLowerCase() === "cash";
  if (claim.coverage_id && !isCash) {
    if (!claim.eligibility_checked_at || !claim.eligibility_response) {
      flags.eligibility_ok = false;
      add(
        missing,
        "eligibility_missing",
        "eligibility",
        "Insured claim requires a recent NPHIES eligibility check. Run /claims/:id/eligibility.",
      );
    } else {
      const age = Date.now() - new Date(claim.eligibility_checked_at).getTime();
      const days = age / (1000 * 60 * 60 * 24);
      if (days > 30) {
        flags.eligibility_ok = false;
        add(
          missing,
          "eligibility_stale",
          "eligibility",
          `Eligibility check is ${Math.floor(days)} days old (>30). Re-check before submission.`,
          "warning",
        );
      }
    }
  } else if (!claim.coverage_id && !isCash && claim.billing_model !== "drg_bundled") {
    // not blocking — cash claims may legitimately lack coverage
  }

  // R1 — visit_eligibility lifecycle: when the loader provides a snapshot of
  // the linked visit_eligibility, only `insured` (or `self_pay` for cash)
  // permits claim submission.
  const ve = (b as unknown as { visitEligibility?: { status?: string } }).visitEligibility;
  if (ve && ve.status) {
    const okStatus = isCash ? ve.status === "self_pay" : ve.status === "insured";
    if (!okStatus) {
      flags.eligibility_lifecycle_ok = false;
      add(
        missing,
        "eligibility_lifecycle_not_ready",
        "eligibility",
        `Visit eligibility status is '${ve.status}'. Must be ${isCash ? "self_pay" : "insured"} before submission.`,
      );
    }
  }

  // R3 — executed-only on all charged items
  const linkedChargeIds = new Set(
    (b.claimItems ?? []).map((i: any) => i.charge_item_id).filter(Boolean),
  );
  for (const ci of b.chargeItems ?? []) {
    if (!linkedChargeIds.has(ci.id)) continue;
    const status = String(ci.status ?? "");
    if (status === "cancelled") {
      flags.executed_only_ok = false;
      add(missing, "charge_cancelled", "execution", `Charged item ${ci.id.slice(0, 8)} is cancelled but linked into the claim.`);
    } else if (status === "ordered") {
      flags.executed_only_ok = false;
      add(
        missing,
        "charge_not_executed",
        "execution",
        `Charged item ${ci.id.slice(0, 8)} (${ci.description ?? ci.sbs_code ?? "—"}) is still in 'ordered' status — execute or remove before billing.`,
      );
    } else if (!EXECUTED_STATES.has(status)) {
      // Unknown non-executed state
      flags.executed_only_ok = false;
      add(
        missing,
        "charge_state_unknown",
        "execution",
        `Charged item ${ci.id.slice(0, 8)} status '${status}' is not an executed state.`,
        "warning",
      );
    }
  }

  // R5 — snapshot locked: claim totals must agree with claim_item sums
  const items = b.claimItems ?? [];
  if (items.length === 0) {
    flags.snapshot_locked = false;
    add(missing, "snapshot_no_items", "snapshot", "Claim has no priced items — re-assemble the claim.");
  } else {
    const sumNet = items.reduce((s: number, i: any) => s + (i.net_minor ?? 0), 0);
    const sumPayer = items.reduce((s: number, i: any) => s + (i.payer_share_minor ?? 0), 0);
    const sumPatient = items.reduce((s: number, i: any) => s + (i.patient_share_minor ?? 0), 0);
    if (Math.abs(sumNet - (claim.total_net_minor ?? 0)) > 1) {
      flags.snapshot_locked = false;
      add(
        missing,
        "snapshot_net_drift",
        "snapshot",
        `Claim total_net_minor (${claim.total_net_minor}) does not equal sum of items (${sumNet}). Re-assemble.`,
      );
    }
    if (Math.abs(sumPayer - (claim.total_payer_share_minor ?? 0)) > 1) {
      flags.snapshot_locked = false;
      add(
        missing,
        "snapshot_payer_drift",
        "snapshot",
        `Claim total_payer_share_minor does not equal sum of items (${sumPayer}).`,
      );
    }
    if (Math.abs(sumPatient - (claim.total_patient_share_minor ?? 0)) > 1) {
      flags.snapshot_locked = false;
      add(
        missing,
        "snapshot_patient_drift",
        "snapshot",
        `Claim total_patient_share_minor does not equal sum of items (${sumPatient}).`,
      );
    }
  }

  // R2 — authorization coverage. Any charged item whose underlying
  // service_master/drug_master has preauth_required=true must have a
  // covering authorization_item on an approved/partially_approved auth
  // request whose valid_to is still in the future.
  const now = Date.now();
  const auths = (b as any).authRequests as any[] | undefined;
  const authItems = (b as any).authItems as any[] | undefined;
  const svcMasters = (b as any).serviceMasters as any[] | undefined;
  const drugMasters = (b as any).drugMasters as any[] | undefined;
  if (auths && authItems && (svcMasters || drugMasters)) {
    const svcPreauth = new Map<string, boolean>((svcMasters ?? []).map((s: any) => [s.id, !!s.preauth_required]));
    const drugPreauth = new Map<string, boolean>((drugMasters ?? []).map((d: any) => [d.id, !!d.preauth_required]));
    const coveringAuthIds = new Set<string>(
      auths.filter((a: any) => {
        if (!["approved", "partially_approved"].includes(String(a.status))) return false;
        if (a.valid_to) {
          const to = new Date(a.valid_to).getTime();
          if (Number.isFinite(to) && to < now) return false;
        }
        return true;
      }).map((a: any) => a.id),
    );
    const coveredServiceIds = new Set<string>();
    const coveredDrugIds = new Set<string>();
    for (const it of authItems) {
      if (!coveringAuthIds.has(it.authorization_request_id)) continue;
      if (String(it.decision) === "rejected") continue;
      if (it.service_id) coveredServiceIds.add(it.service_id);
      if (it.drug_id) coveredDrugIds.add(it.drug_id);
    }
    const chargedById = new Map<string, any>((b.chargeItems ?? []).map((c: any) => [c.id, c]));
    const linkedChargeIds = new Set<string>(
      (b.claimItems ?? []).map((i: any) => i.charge_item_id).filter(Boolean),
    );
    for (const cid of linkedChargeIds) {
      const ch = chargedById.get(cid as string);
      if (!ch) continue;
      const needsSvc = ch.service_id && svcPreauth.get(ch.service_id);
      const needsDrug = ch.drug_id && drugPreauth.get(ch.drug_id);
      if (needsSvc && !coveredServiceIds.has(ch.service_id)) {
        flags.auth_ok = false;
        add(missing, "AUTH_MISSING", "authorization",
          `Charged service ${String(ch.id).slice(0, 8)} requires authorization but has no covering approval.`);
      }
      if (needsDrug && !coveredDrugIds.has(ch.drug_id)) {
        flags.auth_ok = false;
        add(missing, "AUTH_MISSING", "authorization",
          `Charged drug ${String(ch.id).slice(0, 8)} requires authorization but has no covering approval.`);
      }
    }
  }

  return { ok: missing.filter((m) => m.severity === "error").length === 0, missing, flags };
}

/* ---------------------------------------------------------------------------
 * R5 gates — batch / remittance / denial readiness helpers.
 * Kept separate so the R3 readiness validator stays snapshot-focused.
 * ------------------------------------------------------------------------- */
export type R5Blocker =
  | "BATCH_NOT_READY" | "SNAPSHOT_NOT_LOCKED"
  | "REMIT_UNMATCHED_LINES" | "DENIAL_OPEN";

export type R5Issue = { code: R5Blocker; message: string };

/** Every claim in a batch must be readiness=ready and snapshot-locked. */
export function validateBatchClaims(
  claims: Array<{ id: string; readiness_status?: string | null; snapshot_locked_at?: string | null; batch_id?: string | null }>,
): R5Issue[] {
  const issues: R5Issue[] = [];
  for (const c of claims) {
    if (c.readiness_status !== "ready") {
      issues.push({ code: "BATCH_NOT_READY", message: `Claim ${c.id.slice(0, 8)} is not marked ready.` });
    }
    if (!c.snapshot_locked_at) {
      issues.push({ code: "SNAPSHOT_NOT_LOCKED", message: `Claim ${c.id.slice(0, 8)} snapshot is not locked.` });
    }
  }
  return issues;
}

/** Remittance may not be posted while any line is unmatched or in mismatch. */
export function validateRemittanceLines(
  lines: Array<{ match_status: string }>,
): R5Issue[] {
  const bad = lines.filter((l) => l.match_status === "unmatched" || l.match_status === "mismatch");
  return bad.length
    ? [{ code: "REMIT_UNMATCHED_LINES", message: `${bad.length} remittance line(s) still unmatched — reconcile before posting.` }]
    : [];
}

/** A claim with an open denial case cannot be closed until the case resolves. */
export function validateNoOpenDenial(
  cases: Array<{ status: string }>,
): R5Issue[] {
  const open = cases.filter((c) => c.status !== "resolved" && c.status !== "disposed");
  return open.length
    ? [{ code: "DENIAL_OPEN", message: `${open.length} denial case(s) still open on this claim.` }]
    : [];
}

/* ---------------------------------------------------------------------------
 * R6 gates — deposit / refund readiness helpers.
 * ------------------------------------------------------------------------- */
import { defaultRefundMethod } from "./refund-sm";

export type R6Blocker =
  | "CAUTION_CANNOT_SETTLE" | "REFUND_METHOD_MISMATCH"
  | "REFUND_HOLD_OUTSTANDING" | "REFUND_REASON_REQUIRED"
  | "DEPOSIT_ERP_UNPOSTED" | "DEPOSIT_OVERDRAW";

export type R6Issue = { code: R6Blocker; message: string };

/** Apply-to-bill guard: caution deposits require an approved override. */
export function validateDepositApply(deposit: {
  is_caution?: boolean; deposit_no?: string | null; available_minor?: number | null;
}, txn: { amount_minor: number; reason?: string | null; approved_by?: string | null }): R6Issue[] {
  const issues: R6Issue[] = [];
  if (deposit.is_caution) {
    const okOverride = txn.approved_by && txn.reason && txn.reason.startsWith("OVERRIDE:");
    if (!okOverride) {
      issues.push({
        code: "CAUTION_CANNOT_SETTLE",
        message: `Caution deposit ${deposit.deposit_no ?? ""} cannot settle a bill without an approved override.`,
      });
    }
  }
  if ((deposit.available_minor ?? 0) < txn.amount_minor) {
    issues.push({ code: "DEPOSIT_OVERDRAW", message: `Deposit balance is insufficient for this apply.` });
  }
  return issues;
}

/** Refund-method rule + mandatory reason on exception override. */
export function validateRefundRequest(input: {
  original_method: string; refund_method: string;
  exception_override?: boolean; approval_reason?: string | null;
  reason?: string | null;
}): R6Issue[] {
  const issues: R6Issue[] = [];
  if (!input.reason || input.reason.length < 3) {
    issues.push({ code: "REFUND_REASON_REQUIRED", message: "Refund reason is mandatory." });
  }
  const expected = defaultRefundMethod(input.original_method);
  if (expected !== input.refund_method && !input.exception_override) {
    issues.push({
      code: "REFUND_METHOD_MISMATCH",
      message: `Refund method (${input.refund_method}) differs from original (${input.original_method}). Approved exception required.`,
    });
  }
  if (input.exception_override && (!input.approval_reason || input.approval_reason.length < 3)) {
    issues.push({ code: "REFUND_REASON_REQUIRED", message: "Exception override requires an approval reason." });
  }
  return issues;
}

/** Deny closing a deposit while any ERP row is still pending/failed. */
export function validateDepositErpPosted(queue: Array<{ status: string }>): R6Issue[] {
  const open = queue.filter((r) => r.status === "pending" || r.status === "failed");
  return open.length
    ? [{ code: "DEPOSIT_ERP_UNPOSTED", message: `${open.length} ERP posting(s) still pending/failed.` }]
    : [];
}