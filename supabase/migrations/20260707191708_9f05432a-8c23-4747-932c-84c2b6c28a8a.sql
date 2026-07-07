-- Revoke public/authenticated EXECUTE on the new SECURITY DEFINER trigger function.
-- Trigger fires as the table owner regardless; direct EXECUTE is not needed.
REVOKE ALL ON FUNCTION public.clinic_bookings_emit_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clinic_bookings_emit_event() FROM authenticated;
REVOKE ALL ON FUNCTION public.clinic_bookings_emit_event() FROM anon;