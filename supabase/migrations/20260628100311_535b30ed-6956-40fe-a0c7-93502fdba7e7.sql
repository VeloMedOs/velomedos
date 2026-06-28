REVOKE EXECUTE ON FUNCTION public.business_requests_log() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_requests_log() TO service_role;