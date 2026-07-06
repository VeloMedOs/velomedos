
-- Tighten resource_locations INSERT ownership
DROP POLICY IF EXISTS "auth insert locations" ON public.resource_locations;
CREATE POLICY "resource_locations owner insert"
ON public.resource_locations
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'dispatcher'::app_role)
  OR (resource_kind = 'vehicle' AND EXISTS (
        SELECT 1 FROM public.ambulances a
         WHERE a.id = resource_locations.resource_id
           AND a.driver_id = auth.uid()))
  OR (resource_kind IN ('paramedic','doctor') AND resource_id = auth.uid())
);

-- Tighten trip_shares INSERT: must be creator AND tied to the trip
DROP POLICY IF EXISTS "trip_shares owner insert" ON public.trip_shares;
CREATE POLICY "trip_shares owner insert"
ON public.trip_shares
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.trips t
       WHERE t.id = trip_shares.trip_id
         AND (
           (t.resource_kind = 'vehicle' AND EXISTS (
              SELECT 1 FROM public.ambulances a
               WHERE a.id = t.resource_id AND a.driver_id = auth.uid()))
           OR (t.resource_kind IN ('paramedic','doctor') AND t.resource_id = auth.uid())
         )
    )
  )
);

-- Revoke EXECUTE on public SECURITY DEFINER functions from anon/authenticated.
-- These are trigger/predicate helpers not intended for direct RPC by end users.
REVOKE EXECUTE ON FUNCTION public.admission_gate_open(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_seed_roles() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bump_site_content_version(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.business_requests_log() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.business_requests_log_featured() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.charge_is_billed(text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.legal_documents_on_publish() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.site_content_bump_on_publish() FROM anon, authenticated, public;
