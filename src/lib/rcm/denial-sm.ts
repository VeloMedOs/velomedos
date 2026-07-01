/**
 * RCM R5 · Denial-case state machine.
 *
 * pending_action → in_correction → resubmitted → resolved
 *              ↘ accepted → disposed        (finance disposition required)
 */
export type DenialStatus =
  | "pending_action" | "in_correction" | "accepted"
  | "resubmitted" | "resolved" | "disposed";

export const ALL_DENIAL_STATUSES: DenialStatus[] = [
  "pending_action", "in_correction", "accepted", "resubmitted", "resolved", "disposed",
];

export const DENIAL_TRANSITIONS: Record<DenialStatus, DenialStatus[]> = {
  pending_action: ["in_correction", "accepted", "resolved"],
  in_correction:  ["resubmitted", "pending_action", "accepted"],
  resubmitted:    ["resolved", "pending_action"],
  accepted:       ["disposed"],
  resolved:       [],
  disposed:       [],
};

export function canTransitionDenial(from: DenialStatus, to: DenialStatus): boolean {
  return DENIAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export type DenialCategory = "technical" | "medical";
export type DenialFinanceDisposition = "none" | "write_off" | "adjustment";

export const DENIAL_LABEL: Record<DenialStatus, string> = {
  pending_action: "Pending action",
  in_correction:  "In correction",
  accepted:       "Accepted",
  resubmitted:    "Resubmitted",
  resolved:       "Resolved",
  disposed:       "Disposed",
};

export const DENIAL_BUCKET_ORDER: DenialStatus[] = [
  "pending_action", "in_correction", "accepted", "resubmitted", "resolved", "disposed",
];