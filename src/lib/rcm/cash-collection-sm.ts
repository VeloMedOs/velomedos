/**
 * R7 · Cash collection state machine (14-step lifecycle).
 *
 *   draft → posted → (voided?)
 *
 * Method-aware: cash | pos | bank_transfer | cheque | online.
 * Ordered lifecycle (per R7 §A Table 0):
 *
 *   1. allocate/finalize payable (executed lines only)
 *   2. eligibility re-check if bill_date > visit_date
 *   3. apply deposit
 *   4. apply credit-note (wallet)
 *   5. apply wallet balance
 *   6. compute remaining
 *   7. select method
 *   8. capture method details (POS ref, cheque #, bank ref+attachment…)
 *   9. post collection
 *  10. update wallet / outstanding
 *  11. excess deposit routing (retain vs refund)
 *  12. cash session txn append + expected_minor bump
 *  13. print receipt (patient / CHI template)
 *  14. enqueue ERP posting (D365 summary)
 */
export type CashCollectionStatus = "draft" | "posted" | "voided";
export type CashMethod = "cash" | "pos" | "bank_transfer" | "cheque" | "online";

export const CASH_STATUS_LABEL: Record<CashCollectionStatus, string> = {
  draft: "Draft", posted: "Posted", voided: "Voided",
};

export const CASH_METHOD_LABEL: Record<CashMethod, string> = {
  cash: "Cash", pos: "POS card", bank_transfer: "Bank transfer",
  cheque: "Cheque", online: "Online",
};

export const CASH_TRANSITIONS: Record<CashCollectionStatus, CashCollectionStatus[]> = {
  draft:  ["posted", "voided"],
  posted: ["voided"],
  voided: [],
};

export function canTransitionCash(from: CashCollectionStatus, to: CashCollectionStatus): boolean {
  return CASH_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Bucket used by the Daylight worklist. */
export type CashBucket = "draft" | "posted_today" | "voided" | "session_open" | "outstanding";

export function bucketOfCashCollection(row: {
  status: string;
  outstanding_after_minor?: number | null;
  posted_at?: string | null;
  session_id?: string | null;
}): CashBucket {
  if (row.status === "voided") return "voided";
  if (row.status === "draft") return "draft";
  const outstanding = Number(row.outstanding_after_minor ?? 0);
  if (outstanding > 0) return "outstanding";
  if (row.session_id) return "session_open";
  const today = new Date().toISOString().slice(0, 10);
  return (row.posted_at ?? "").startsWith(today) ? "posted_today" : "posted_today";
}

/** Method → required detail fields (server-side gate). */
export function requiredMethodFields(method: CashMethod): string[] {
  switch (method) {
    case "pos":           return ["pos_ref"];
    case "cheque":        return ["cheque_no", "cheque_date"];
    case "bank_transfer": return ["bank_ref"];
    case "online":        return ["online_ref"];
    default: return [];
  }
}