
-- self-read policy so SECURITY INVOKER helpers can resolve the caller's role
CREATE POLICY portal_assignments_self_read ON public.portal_role_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER FUNCTION public.has_portal_role(uuid, public.portal_role) SECURITY INVOKER;
ALTER FUNCTION public.is_portal_staff(uuid) SECURITY INVOKER;
ALTER FUNCTION public.portal_effective_config(uuid) SECURITY INVOKER;
