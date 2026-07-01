/**
 * Daylight status → tone map (Three-Second-Rule).
 *
 * Maps the REAL persisted tokens for the R1 tables:
 *   - visit_eligibility.status         → EligibilityStatus SSOT (rcm/eligibility-sm.ts)
 *   - policy_activation_request.status → pending | in_progress | activated | rejected
 *   - contract_change_request.status   → draft | approved | applied | rejected
 *
 * Tone tokens mirror the Daylight palette:
 *   teal   = eligible / clean / activated / applied
 *   sky    = in-progress / submitted
 *   amber  = pending / awaiting / new
 *   coral  = denial / error / rejected
 *   muted  = cancelled / draft / terminal-neutral
 *   violet = DRG / VBHC (reserved)
 */
import type { EligibilityStatus } from "@/lib/rcm/eligibility-sm";

export type StatusTone = "teal" | "sky" | "amber" | "coral" | "muted" | "violet";

export type EligibilityBucket = "needs_me_now" | "in_flight" | "cleared" | "dead";

const ELIGIBILITY_TONE: Record<EligibilityStatus, StatusTone> = {
  new: "amber",
  checking: "sky",
  eligible: "teal",
  not_eligible: "coral",
  error: "coral",
  exception_review: "amber",
  exception_approved: "sky",
  activation_pending: "amber",
  activated: "teal",
  insured: "teal",
  self_pay: "muted",
  cancelled: "muted",
};

export function toneOfEligibility(status: EligibilityStatus | string): StatusTone {
  return ELIGIBILITY_TONE[status as EligibilityStatus] ?? "muted";
}

export function bucketOfEligibility(status: EligibilityStatus | string): EligibilityBucket {
  switch (status) {
    case "new":
    case "not_eligible":
    case "error":
    case "exception_review":
      return "needs_me_now";
    case "checking":
    case "exception_approved":
    case "activation_pending":
      return "in_flight";
    case "eligible":
    case "activated":
    case "insured":
      return "cleared";
    case "self_pay":
    case "cancelled":
      return "dead";
    default:
      return "needs_me_now";
  }
}

const POLICY_ACTIVATION_TONE: Record<string, StatusTone> = {
  pending: "amber",
  in_progress: "sky",
  activated: "teal",
  rejected: "coral",
};
export function toneOfPolicyActivation(status: string): StatusTone {
  return POLICY_ACTIVATION_TONE[status] ?? "muted";
}

const CONTRACT_CHANGE_TONE: Record<string, StatusTone> = {
  draft: "muted",
  approved: "sky",
  applied: "teal",
  rejected: "coral",
};
export function toneOfContractChange(status: string): StatusTone {
  return CONTRACT_CHANGE_TONE[status] ?? "muted";
}

/**
 * Presentational styles for a tone chip. Daylight tokens only.
 * Consumers apply via `style={toneStyle(tone)}` on a `<span>` / pill.
 */
export function toneStyle(tone: StatusTone): { background: string; color: string; borderColor?: string } {
  switch (tone) {
    case "teal":   return { background: "var(--clin-teal-tint)",   color: "var(--teal)" };
    case "sky":    return { background: "var(--clin-info-tint)",   color: "var(--clin-info)" };
    case "amber":  return { background: "var(--clin-warn-tint)",   color: "var(--clin-warn)" };
    case "coral":  return { background: "var(--clin-crit-tint)",   color: "var(--clin-crit)" };
    case "violet": return { background: "var(--clin-vbhc-tint, var(--clin-info-tint))", color: "var(--clin-vbhc, var(--clin-info))" };
    case "muted":
    default:       return { background: "var(--clin-sunken)",      color: "var(--clin-muted)" };
  }
}