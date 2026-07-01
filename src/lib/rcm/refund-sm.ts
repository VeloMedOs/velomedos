/**
 * RCM R6 · Refund request state machine.
 *
 *   pending → approved → executed
 *          ↘ rejected  (retained on deposit)
 *          ↘ held      (finance review)
 *   held    → approved | rejected
 *
 * DB `refund_method_guard` blocks method mismatches without an approved
 * `exception_override + approval_reason`. Every `executed` refund enqueues
 * an `erp_posting_queue` row (contract only; R7 builds the D365 connector).
 */
export type RefundStatus = "pending" | "approved" | "rejected" | "executed" | "held";

export const ALL_REFUND_STATUSES: RefundStatus[] = ["pending","held","approved","rejected","executed"];

export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  pending:  ["approved","rejected","held"],
  held:     ["approved","rejected"],
  approved: ["executed","rejected"],
  executed: [],
  rejected: [],
};
export function canTransitionRefund(from: RefundStatus, to: RefundStatus): boolean {
  return REFUND_TRANSITIONS[from]?.includes(to) ?? false;
}

export const REFUND_LABEL: Record<RefundStatus, string> = {
  pending: "Pending", held: "On hold", approved: "Approved",
  rejected: "Rejected", executed: "Executed",
};

export type RefundMethod = "cash" | "bank_transfer" | "card_reversal";

export const REFUND_METHOD_LABEL: Record<RefundMethod, string> = {
  cash: "Cash", bank_transfer: "Bank transfer", card_reversal: "Card reversal",
};

/** Default same-method mapping used by the DB guard. */
export function defaultRefundMethod(originalMethod: string): RefundMethod {
  switch (originalMethod) {
    case "cash":          return "cash";
    case "bank_transfer": return "bank_transfer";
    case "card":          return "card_reversal";
    default:              return "bank_transfer";
  }
}

export function isMethodMismatch(originalMethod: string, refundMethod: string): boolean {
  return defaultRefundMethod(originalMethod) !== refundMethod;
}

export type RefundBucket = "pending" | "held" | "approved" | "executed" | "rejected";
export const REFUND_BUCKET_ORDER: RefundBucket[] = ["pending","held","approved","executed","rejected"];
export function bucketOfRefund(row: { status: string }): RefundBucket {
  return (row.status as RefundBucket) ?? "pending";
}