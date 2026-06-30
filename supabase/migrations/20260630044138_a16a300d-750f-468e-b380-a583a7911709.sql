
-- 1) oauth_events: restrict superadmin SELECT policy to authenticated
DROP POLICY IF EXISTS "superadmin reads oauth events" ON public.oauth_events;
CREATE POLICY "superadmin reads oauth events" ON public.oauth_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'superadmin'::app_role));

-- 2) ops_workspace_settings: restrict open read to authenticated
DROP POLICY IF EXISTS "anyone reads" ON public.ops_workspace_settings;
CREATE POLICY "authenticated reads workspace settings" ON public.ops_workspace_settings
  FOR SELECT TO authenticated
  USING (true);

-- 3) care_visit_vitals: allow patient (recipient) to read their own visit vitals
CREATE POLICY "patient reads own visit vitals" ON public.care_visit_vitals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_visits v
    JOIN public.care_recipients r ON r.id = v.recipient_id
    WHERE v.id = care_visit_vitals.care_visit_id
      AND r.patient_id = auth.uid()
  ));

-- 4) Revoke EXECUTE on SECURITY DEFINER trigger-only functions from anon/authenticated/public
REVOKE EXECUTE ON FUNCTION public.handle_new_user()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_seed_roles()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.business_requests_log()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.legal_documents_on_publish() FROM PUBLIC, anon, authenticated;

-- get_user_roles and is_tenant_member: keep callable by authenticated only (revoke anon/public)
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid,uuid)  TO authenticated;
