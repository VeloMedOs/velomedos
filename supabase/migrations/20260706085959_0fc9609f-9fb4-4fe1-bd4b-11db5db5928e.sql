-- M10: RCM Admin config registry + history.

CREATE TABLE public.rcm_admin_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rcm_admin_config TO authenticated;
GRANT ALL ON public.rcm_admin_config TO service_role;
ALTER TABLE public.rcm_admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read rcm_admin_config"
  ON public.rcm_admin_config FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Tenant admins manage rcm_admin_config"
  ON public.rcm_admin_config FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_rcm_admin_config_updated_at BEFORE UPDATE ON public.rcm_admin_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.rcm_admin_config_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  old_value jsonb NULL,
  new_value jsonb NULL,
  actor_id uuid NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rcm_admin_config_history TO authenticated;
GRANT ALL ON public.rcm_admin_config_history TO service_role;
ALTER TABLE public.rcm_admin_config_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read rcm_admin_config_history"
  ON public.rcm_admin_config_history FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Insert rcm_admin_config_history via tenant"
  ON public.rcm_admin_config_history FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

-- Change trigger writes the history row.
CREATE OR REPLACE FUNCTION public.rcm_admin_config_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.rcm_admin_config_history (tenant_id, key, old_value, new_value, actor_id)
    VALUES (NEW.tenant_id, NEW.key, OLD.value, NEW.value, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.rcm_admin_config_history (tenant_id, key, old_value, new_value, actor_id)
    VALUES (NEW.tenant_id, NEW.key, NULL, NEW.value, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rcm_admin_config_audit
  AFTER INSERT OR UPDATE ON public.rcm_admin_config
  FOR EACH ROW EXECUTE FUNCTION public.rcm_admin_config_audit();

-- Read helper.
CREATE OR REPLACE FUNCTION public.rcm_admin_config_get(_tenant uuid, _key text, _default jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value FROM public.rcm_admin_config WHERE tenant_id = _tenant AND key = _key), _default);
$$;
GRANT EXECUTE ON FUNCTION public.rcm_admin_config_get(uuid, text, jsonb) TO authenticated, service_role;