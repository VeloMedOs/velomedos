/**
 * R7 · Cash refund state machine (16-step, extends R6 refund_request).
 *
 *   requested → approved → executed → posted
 *                       ↘ rejected
 *
 * Table 1 — the 16-step flow:
 *   1. select refund reference (receipt / bill / txn)
 *   2. reason (overpay | cancel | return | correction | cash-copay | uncovered-self-pay)
 *   3. validate eligibility: executed service must be REVERTED before refund
 *   4. determine original method(s) + split
 *   5. refund vs credit note
 *   6. capture refund request (reason mandatory)
 *   7. same-method rule (POS/online reversal; bank requires evidence)
 *   8. attach docs
 *   9. approval hierarchy
 *  10. execute refund
 *  11. VAT / ZATCA reversal (tax credit/debit note if a taxed invoice affected)
 *  12. refund receipt (negatives + tax-reversal refs)
 *  13. update wallet / deposit balances
 *  14. cash session txn append (direction=out)
 *  15. enqueue ERP posting
 *  16. audit trail
 */
export type CashRefundStep =
  | "select_reference" | "capture_reason" | "revert_service" | "method_split"
  | "choose_refund_or_cn" | "raise_request" | "same_method_check" | "attach_docs"
  | "approve" | "execute" | "vat_reversal" | "print_receipt"
  | "update_balances" | "session_append" | "erp_post" | "audit";

export const REFUND_STEP_ORDER: CashRefundStep[] = [
  "select_reference","capture_reason","revert_service","method_split",
  "choose_refund_or_cn","raise_request","same_method_check","attach_docs",
  "approve","execute","vat_reversal","print_receipt",
  "update_balances","session_append","erp_post","audit",
];

/** Same-method mapping per source rule table. */
export function expectedRefundMethod(original: string): string | null {
  switch (original) {
    case "cash":          return "cash";
    case "bank_transfer": return "bank_transfer";
    case "card":          return "card_reversal";
    case "pos":           return "card_reversal";
    case "wallet":        return "bank_transfer";
    case "insurance":     return "bank_transfer";
    case "online":        return "online_reversal";
    default: return null;
  }
}

export function requiresVatReversal(input: { has_taxed_invoice?: boolean }) {
  return !!input.has_taxed_invoice;
}