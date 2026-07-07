
-- Switch is_tenant_admin off SECURITY DEFINER; it only calls has_role and
-- is_tenant_member (both STABLE, invoker-safe), so definer privileges are
-- unnecessary and trip the Supabase definer-exposure linter.
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'superadmin')
    OR (
      public.is_tenant_member(_user_id, _tenant)
      AND (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'dispatcher'))
    )
$function$;

REVOKE EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid, uuid) TO authenticated, service_role;
