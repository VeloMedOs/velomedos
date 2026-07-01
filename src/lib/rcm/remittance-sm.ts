/**
 * RCM R5 · Remittance state machine.
 *
 * staged → matching → matched → posted → reconciliation → closed
 *
 * Post is finance-permission-gated (capability `claim.post`). A remittance
 * with any short-pay / over-pay line is routed to `reconciliation` instead
 * of `closed` until manually reconciled.
 */
export type RemittanceStatus =
  | "staged" | "matching" | "matched" | "posted" | "reconciliation" | "closed";

export const ALL_REMITTANCE_STATUSES: RemittanceStatus[] = [
  "staged", "matching", "matched", "posted", "reconciliation", "closed",
];

export const REMITTANCE_TRANSITIONS: Record<RemittanceStatus, RemittanceStatus[]> = {
  staged:         ["matching", "matched", "closed"],
  matching:       ["matched", "staged"],
  matched:        ["posted", "matching"],
  posted:         ["reconciliation", "closed"],
  reconciliation: ["posted", "closed"],
  closed:         [],
};

export function canTransitionRemittance(from: RemittanceStatus, to: RemittanceStatus): boolean {
  return REMITTANCE_TRANSITIONS[from]?.includes(to) ?? false;
}

export type RemittanceMatchStatus = "unmatched" | "matched" | "mismatch" | "manual";

export const REMITTANCE_LABEL: Record<RemittanceStatus, string> = {
  staged:         "Staged",
  matching:       "Matching",
  matched:        "Matched · ready to post",
  posted:         "Posted",
  reconciliation: "Reconciliation",
  closed:         "Closed",
};