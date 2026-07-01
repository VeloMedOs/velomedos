/**
 * RCM R5 · Claim batch state machine.
 *
 * open → submitting → submitted → closed
 *   ↓
 * cancelled  (only from `open`)
 *
 * Guards live in the service layer:
 *  - only add claims with `readiness_status = 'ready'`;
 *  - all claims in a batch share the same payer + integration_type;
 *  - `submit` requires ≥ 1 claim + snapshot_locked_at on every claim.
 */
export type BatchStatus = "open" | "submitting" | "submitted" | "closed" | "cancelled";

export const ALL_BATCH_STATUSES: BatchStatus[] = [
  "open", "submitting", "submitted", "closed", "cancelled",
];

export const BATCH_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  open:       ["submitting", "cancelled"],
  submitting: ["submitted", "open"],
  submitted:  ["closed"],
  closed:     [],
  cancelled:  [],
};

export function canTransitionBatch(from: BatchStatus, to: BatchStatus): boolean {
  return BATCH_TRANSITIONS[from]?.includes(to) ?? false;
}

export const BATCH_LABEL: Record<BatchStatus, string> = {
  open:       "Open",
  submitting: "Submitting",
  submitted:  "Submitted",
  closed:     "Closed",
  cancelled:  "Cancelled",
};