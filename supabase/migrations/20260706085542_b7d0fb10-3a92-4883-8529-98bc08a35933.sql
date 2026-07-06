-- M06: Extend wallet_txn source CHECK and add related_exception_id column.
-- Emergency reconciliation posts a debit or credit to the patient wallet after NPHIES reply.
ALTER TABLE public.wallet_txn DROP CONSTRAINT IF EXISTS wallet_txn_source_check;
ALTER TABLE public.wallet_txn
  ADD CONSTRAINT wallet_txn_source_check
  CHECK (source IN ('credit_note','refund','manual','apply_to_bill','deposit_convert','emergency_reconcile'));

ALTER TABLE public.wallet_txn
  ADD COLUMN IF NOT EXISTS related_exception_id uuid NULL;