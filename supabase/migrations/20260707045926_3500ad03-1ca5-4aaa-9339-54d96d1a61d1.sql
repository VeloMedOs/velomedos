
ALTER TABLE public.clinic_bookings
  ALTER COLUMN source TYPE public.visit_source
  USING NULLIF(source, '')::public.visit_source;

-- Silence the SECURITY DEFINER helper linter warnings: this helper is only
-- called from triggers running as table owner; revoke from callable roles.
REVOKE ALL ON FUNCTION public._order_item_encounter(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._order_item_encounter(text, uuid) FROM anon, authenticated;
