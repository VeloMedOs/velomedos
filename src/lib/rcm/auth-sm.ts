/**
 * RCM R2 · Authorization state machine.
 *
 * 17-state lifecycle. `transitions[from]` lists allowed `to` states.
 * Any illegal transition is rejected at the service layer with a 409
 * `invalid_state` envelope — never a silent no-op.
 */
export type AuthStatus =
  | "new" | "scrubbing" | "ready_to_submit" | "submitted" | "queued_at_payer"
  | "in_review" | "more_info_requested" | "approved" | "partially_approved"
  | "rejected" | "expired" | "cancelled" | "appealed" | "appeal_approved"
  | "appeal_rejected" | "converted_to_self_pay" | "closed";

export const ALL_AUTH_STATUSES: AuthStatus[] = [
  "new","scrubbing","ready_to_submit","submitted","queued_at_payer",
  "in_review","more_info_requested","approved","partially_approved",
  "rejected","expired","cancelled","appealed","appeal_approved",
  "appeal_rejected","converted_to_self_pay","closed",
];

export const AUTH_TRANSITIONS: Record<AuthStatus, AuthStatus[]> = {
  new: ["scrubbing", "cancelled", "converted_to_self_pay"],
  scrubbing: ["ready_to_submit", "more_info_requested", "cancelled"],
  ready_to_submit: ["submitted", "cancelled", "converted_to_self_pay"],
  submitted: ["queued_at_payer", "in_review", "more_info_requested", "rejected", "approved", "partially_approved"],
  queued_at_payer: ["in_review", "more_info_requested", "approved", "partially_approved", "rejected"],
  in_review: ["more_info_requested", "approved", "partially_approved", "rejected"],
  more_info_requested: ["scrubbing", "ready_to_submit", "cancelled"],
  approved: ["expired", "closed", "appealed"],
  partially_approved: ["appealed", "expired", "closed"],
  rejected: ["appealed", "converted_to_self_pay", "closed"],
  appealed: ["appeal_approved", "appeal_rejected"],
  appeal_approved: ["closed", "expired"],
  appeal_rejected: ["converted_to_self_pay", "closed"],
  expired: ["appealed", "closed"],
  cancelled: ["closed"],
  converted_to_self_pay: ["closed"],
  closed: [],
};

export function canTransition(from: AuthStatus, to: AuthStatus): boolean {
  return AUTH_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Decision → status shorthand used by the decision endpoint. */
export function statusForDecision(decision: "approve" | "partial" | "reject"): AuthStatus {
  if (decision === "approve") return "approved";
  if (decision === "partial") return "partially_approved";
  return "rejected";
}

/** Terminal (no forward transitions) — used by the worklist for the "closed" bucket. */
export function isTerminal(status: AuthStatus): boolean {
  return AUTH_TRANSITIONS[status].length === 0;
}

export type AuthBucket = "needs_me_now" | "in_flight" | "decided" | "closed";

/** Bucket used by the Daylight worklist tiles. */
export function bucketOfAuth(status: AuthStatus): AuthBucket {
  switch (status) {
    case "new":
    case "scrubbing":
    case "more_info_requested":
      return "needs_me_now";
    case "ready_to_submit":
    case "submitted":
    case "queued_at_payer":
    case "in_review":
    case "appealed":
      return "in_flight";
    case "approved":
    case "partially_approved":
    case "rejected":
    case "appeal_approved":
    case "appeal_rejected":
      return "decided";
    case "expired":
    case "cancelled":
    case "converted_to_self_pay":
    case "closed":
      return "closed";
  }
}

export function toneOfAuth(status: AuthStatus): "teal" | "amber" | "emergency" | "muted" | "action" {
  switch (status) {
    case "approved":
    case "appeal_approved":
      return "teal";
    case "partially_approved":
    case "more_info_requested":
    case "in_review":
      return "amber";
    case "rejected":
    case "appeal_rejected":
    case "expired":
      return "emergency";
    case "cancelled":
    case "converted_to_self_pay":
    case "closed":
      return "muted";
    default:
      return "action";
  }
}