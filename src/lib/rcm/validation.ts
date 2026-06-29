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

  // R2 auth, R4 admission/discharge — not yet schema-modeled. Placeholder
  // returns ok=true so we don't false-block claims when the relevant tables
  // arrive in later phases.

  return { ok: missing.filter((m) => m.severity === "error").length === 0, missing, flags };
}