
-- 1. trip_shares: scope to creator or staff
DROP POLICY IF EXISTS "auth manage shares" ON public.trip_shares;
CREATE POLICY "trip_shares staff or owner read" ON public.trip_shares FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher'));
CREATE POLICY "trip_shares owner insert" ON public.trip_shares FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "trip_shares owner update" ON public.trip_shares FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "trip_shares owner delete" ON public.trip_shares FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(),'admin'));

-- 2. trips: restrict to staff or assigned driver
DROP POLICY IF EXISTS "auth read trips" ON public.trips;
DROP POLICY IF EXISTS "auth update trips" ON public.trips;
DROP POLICY IF EXISTS "auth write trips" ON public.trips;
CREATE POLICY "trips staff read" ON public.trips FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher')
    OR (resource_kind = 'vehicle' AND EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = trips.resource_id AND a.driver_id = auth.uid()))
    OR (resource_kind IN ('paramedic','doctor') AND resource_id = auth.uid())
  );
CREATE POLICY "trips staff insert" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher')
    OR (resource_kind = 'vehicle' AND EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = trips.resource_id AND a.driver_id = auth.uid()))
    OR (resource_kind IN ('paramedic','doctor') AND resource_id = auth.uid())
  );
CREATE POLICY "trips staff update" ON public.trips FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher')
    OR (resource_kind = 'vehicle' AND EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = trips.resource_id AND a.driver_id = auth.uid()))
  )
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher')
    OR (resource_kind = 'vehicle' AND EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = trips.resource_id AND a.driver_id = auth.uid()))
  );

-- 3. resource_locations: restrict reads to staff or owning driver
DROP POLICY IF EXISTS "auth read locations" ON public.resource_locations;
CREATE POLICY "resource_locations staff read" ON public.resource_locations FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'dispatcher')
    OR (resource_kind = 'vehicle' AND EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = resource_locations.resource_id AND a.driver_id = auth.uid()))
    OR (resource_kind IN ('paramedic','doctor') AND resource_id = auth.uid())
  );

-- 4. web_leads: allow public lead submission
CREATE POLICY "web_leads public insert" ON public.web_leads FOR INSERT TO anon, authenticated
  WITH CHECK (true);
GRANT INSERT ON public.web_leads TO anon;

-- 5. Revoke public execute on internal functions
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_seed_roles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon, authenticated;
-- has_role is referenced by RLS policies; keep it callable by authenticated only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
