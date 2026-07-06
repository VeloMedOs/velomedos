CREATE OR REPLACE FUNCTION public.wallet_apply_txn(_wallet_id uuid, _delta_minor bigint)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.patient_wallet
     SET balance_minor = balance_minor + _delta_minor,
         updated_at = now()
   WHERE id = _wallet_id
  RETURNING balance_minor;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_apply_txn(uuid, bigint) TO authenticated, service_role;

COMMENT ON FUNCTION public.wallet_apply_txn IS
'Atomic wallet balance mutation — the only supported write path for public.patient_wallet.balance_minor. Emergency reconcile and other wallet flows MUST call this rather than performing a client-side read-modify-write.';