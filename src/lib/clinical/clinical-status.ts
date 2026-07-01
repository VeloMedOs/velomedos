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
 * R3 · Claim status → tone map. Statuses come from `claim.status` (SSOT in
 * `src/lib/rcm/claim-sm.ts`).
 */
const CLAIM_TONE: Record<string, StatusTone> = {
  draft: "muted",
  assembled: "muted",
  scrubbing: "sky",
  scrub_failed: "coral",
  ready: "teal",
  auth_hold: "amber",
  coding_hold: "amber",
  priced: "teal",
  submitted: "sky",
  accepted: "teal",
  rejected: "coral",
  resubmit_required: "amber",
  adjudicated: "violet",
  closed: "muted",
};
export function toneOfClaim(status: string): StatusTone {
  return CLAIM_TONE[status] ?? "muted";
}

/**
 * R4 · Admission / IP bucket → tone map. Buckets come from
 * {@link import("@/lib/rcm/ip-accounting-sm").bucketOfAdmission}.
 */
const IP_BUCKET_TONE: Record<string, StatusTone> = {
  requested:           "amber",
  lounge:              "amber",
  reception:           "sky",
  in_house:            "teal",
  discharge_advice:    "sky",
  discharge_order:     "sky",
  medical_discharge:   "sky",
  financial_discharge: "amber",
  discharged:          "muted",
  cancelled:           "muted",
};
export function toneOfIpBucket(bucket: string): StatusTone {
  return IP_BUCKET_TONE[bucket] ?? "muted";
}

/** Admission_request.status token → tone (used inside detail drawers). */
const ADMISSION_STATUS_TONE: Record<string, StatusTone> = {
  requested:  "amber",
  authorized: "sky",
  lounge:     "amber",
  admitted:   "teal",
  discharged: "muted",
  cancelled:  "muted",
};
export function toneOfAdmissionStatus(status: string): StatusTone {
  return ADMISSION_STATUS_TONE[status] ?? "muted";
}

/* ─────────────────────── R5 · Batch / Remit / Denial ─────────────────────── */

const BATCH_TONE: Record<string, StatusTone> = {
  open: "amber",
  submitting: "sky",
  submitted: "teal",
  closed: "muted",
  cancelled: "muted",
};
export function toneOfBatchStatus(status: string): StatusTone {
  return BATCH_TONE[status] ?? "muted";
}

const REMITTANCE_TONE: Record<string, StatusTone> = {
  staged: "amber",
  matching: "sky",
  matched: "sky",
  posted: "teal",
  reconciliation: "coral",
  closed: "muted",
};
export function toneOfRemittanceStatus(status: string): StatusTone {
  return REMITTANCE_TONE[status] ?? "muted";
}

const REMITTANCE_MATCH_TONE: Record<string, StatusTone> = {
  unmatched: "coral",
  mismatch: "coral",
  matched: "teal",
  manual: "amber",
};
export function toneOfRemittanceMatch(status: string): StatusTone {
  return REMITTANCE_MATCH_TONE[status] ?? "muted";
}

const DENIAL_TONE: Record<string, StatusTone> = {
  pending_action: "coral",
  in_correction: "amber",
  accepted: "sky",
  resubmitted: "sky",
  resolved: "teal",
  disposed: "muted",
};
export function toneOfDenialStatus(status: string): StatusTone {
  return DENIAL_TONE[status] ?? "muted";
}

const READINESS_TONE: Record<string, StatusTone> = {
  ready: "teal",
  needs_correction: "coral",
  hold: "amber",
};
export function toneOfReadiness(status: string | null | undefined): StatusTone {
  return status ? READINESS_TONE[status] ?? "muted" : "muted";
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