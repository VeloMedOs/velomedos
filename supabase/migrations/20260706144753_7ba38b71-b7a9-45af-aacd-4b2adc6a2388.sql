REVOKE EXECUTE ON FUNCTION public.wallet_apply_txn(uuid, bigint) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.wallet_apply_txn(uuid, bigint) TO service_role;