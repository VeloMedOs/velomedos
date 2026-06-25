
-- Tighten ambulance_locations insert
DROP POLICY IF EXISTS "locations driver insert" ON public.ambulance_locations;
CREATE POLICY "locations driver insert" ON public.ambulance_locations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = ambulance_id AND a.driver_id = auth.uid())
  OR public.has_role(auth.uid(),'dispatcher')
  OR public.has_role(auth.uid(),'admin')
);

-- Lock down security definer functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated, service_role;
