/**
 * RCM R3 · Claim lifecycle state machine.
 *
 * 14 states. `CLAIM_TRANSITIONS[from]` lists allowed `to` states.
 * Any illegal transition is rejected at the service layer with a 409
 * `invalid_state` envelope — never a silent no-op. Mirrors the R2 auth
 * state-machine pattern (auth-sm.ts).
 */
export type ClaimStatus =
  | "draft" | "assembled" | "scrubbing" | "scrub_failed"
  | "ready" | "auth_hold" | "coding_hold" | "priced"
  | "submitted" | "accepted" | "rejected" | "resubmit_required"
  | "adjudicated" | "closed";

export const ALL_CLAIM_STATUSES: ClaimStatus[] = [
  "draft","assembled","scrubbing","scrub_failed","ready","auth_hold","coding_hold",
  "priced","submitted","accepted","rejected","resubmit_required","adjudicated","closed",
];

export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft:              ["assembled", "closed"],
  assembled:          ["scrubbing", "draft", "closed"],
  scrubbing:          ["scrub_failed", "ready", "auth_hold", "coding_hold", "priced"],
  scrub_failed:       ["scrubbing", "draft", "closed"],
  auth_hold:          ["scrubbing", "ready", "closed"],
  coding_hold:        ["scrubbing", "ready", "closed"],
  priced:             ["ready", "scrubbing"],
  ready:              ["submitted", "scrubbing", "draft", "closed"],
  submitted:          ["accepted", "rejected", "resubmit_required"],
  accepted:           ["adjudicated", "closed"],
  rejected:           ["resubmit_required", "closed"],
  resubmit_required:  ["draft", "closed"],
  adjudicated:        ["closed"],
  closed:             [],
};

export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  return CLAIM_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Bucketise a claim status for the worklist UI. */
export type ClaimBucket =
  | "draft" | "scrub_failed" | "ready" | "auth_hold" | "coding_hold"
  | "submitted" | "rejected" | "adjudicated" | "closed";

export function bucketOfClaim(status: string): ClaimBucket {
  switch (status) {
    case "draft": case "assembled": case "scrubbing": return "draft";
    case "scrub_failed": return "scrub_failed";
    case "auth_hold": return "auth_hold";
    case "coding_hold": return "coding_hold";
    case "priced": case "ready": return "ready";
    case "submitted": return "submitted";
    case "accepted": return "submitted";
    case "rejected": case "resubmit_required": return "rejected";
    case "adjudicated": return "adjudicated";
    default: return "closed";
  }
}

export const CLAIM_BUCKET_ORDER: ClaimBucket[] = [
  "draft","scrub_failed","auth_hold","coding_hold","ready","submitted","rejected","adjudicated","closed",
];

export const CLAIM_BUCKET_LABEL: Record<ClaimBucket, string> = {
  draft: "Draft",
  scrub_failed: "Scrub failed",
  ready: "Ready to submit",
  auth_hold: "Auth hold",
  coding_hold: "Coding hold",
  submitted: "Submitted",
  rejected: "Rejected",
  adjudicated: "Adjudicated",
  closed: "Closed",
};

export type BulkClaimAction =
  | "assign_me" | "scrub" | "assemble" | "submit" | "void" | "resubmit";