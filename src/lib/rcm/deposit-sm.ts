/**
 * RCM R6 · Deposit state machine.
 *
 * Lifecycle (matches deposit_status enum after R6-mig-1):
 *
 *   requested → collected → partially_applied → applied
 *                        ↘ refunded
 *                        ↘ transferred
 *   requested → held (approval hold before collection posts)
 *   held      → collected | cancelled
 *   any       → cancelled  (before txns are applied)
 *
 * Guards live in the API + DB triggers:
 *  - caution deposits reject `apply` txns without an approved OVERRIDE reason;
 *  - `deposit_txn_apply` recomputes available_minor + projects the status;
 *  - `refund_method_guard` blocks method mismatches without exception override.
 */
export type DepositStatus =
  | "requested" | "collected" | "held" | "partially_applied"
  | "applied"   | "refunded"  | "transferred" | "cancelled" | "pending";

export const ALL_DEPOSIT_STATUSES: DepositStatus[] = [
  "requested","held","collected","partially_applied","applied",
  "refunded","transferred","cancelled","pending",
];

export const DEPOSIT_TRANSITIONS: Record<DepositStatus, DepositStatus[]> = {
  requested:         ["held","collected","cancelled"],
  pending:           ["held","collected","cancelled"],
  held:              ["collected","cancelled"],
  collected:         ["partially_applied","applied","refunded","transferred","cancelled"],
  partially_applied: ["applied","refunded","transferred"],
  applied:           ["refunded"],
  refunded:          [],
  transferred:       [],
  cancelled:         [],
};

export function canTransitionDeposit(from: DepositStatus, to: DepositStatus): boolean {
  return DEPOSIT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const DEPOSIT_LABEL: Record<DepositStatus, string> = {
  requested: "Requested", pending: "Pending", held: "On hold",
  collected: "Collected", partially_applied: "Partially applied",
  applied: "Applied", refunded: "Refunded", transferred: "Transferred",
  cancelled: "Cancelled",
};

export type DepositType = "general" | "encounter" | "department" | "billing_group" | "order_item" | "caution";

export const DEPOSIT_TYPE_LABEL: Record<DepositType, string> = {
  general: "General", encounter: "Encounter", department: "Department",
  billing_group: "Billing group", order_item: "Order item", caution: "Caution",
};

export type DepositBucket = "held" | "partially_applied" | "applied" | "refunded" | "transferred" | "caution_outstanding" | "collected";

export function bucketOfDeposit(row: { status: string; is_caution?: boolean; available_minor?: number | null }): DepositBucket {
  const s = row.status;
  if (row.is_caution && (s === "collected" || s === "partially_applied") && (row.available_minor ?? 0) > 0) return "caution_outstanding";
  if (s === "held") return "held";
  if (s === "partially_applied") return "partially_applied";
  if (s === "applied") return "applied";
  if (s === "refunded") return "refunded";
  if (s === "transferred") return "transferred";
  return "collected";
}

export const DEPOSIT_BUCKET_ORDER: DepositBucket[] = [
  "held", "caution_outstanding", "collected", "partially_applied", "applied", "refunded", "transferred",
];