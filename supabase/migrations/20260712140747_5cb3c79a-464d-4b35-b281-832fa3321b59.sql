-- M-GR1-01 · Tenant type + lifecycle enums and columns
DO $$ BEGIN
  CREATE TYPE public.tenant_type AS ENUM ('sandbox','partner','production');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tenant_lifecycle AS ENUM ('intake','provisioning','active','suspended','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.corporate_accounts
  ADD COLUMN IF NOT EXISTS tenant_type public.tenant_type NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS tenant_lifecycle public.tenant_lifecycle NOT NULL DEFAULT 'active';

-- M-GR1-06 · Backfill known sandbox tenant
UPDATE public.corporate_accounts
   SET tenant_type = 'sandbox'
 WHERE id = '4b1916a1-5774-49f6-9c71-c5a38f165767'
   AND tenant_type <> 'sandbox';

-- M-GR1-02 · Reviewer notes on business_requests
ALTER TABLE public.business_requests
  ADD COLUMN IF NOT EXISTS reviewer_notes text;

-- M-GR1-03 · Tenant provisioning request (Six Phases handoff)
CREATE TABLE IF NOT EXISTS public.tenant_provisioning_request (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_request_id uuid REFERENCES public.business_requests(id) ON DELETE SET NULL,
  requested_slug text NOT NULL,
  requested_project_ref text,
  admin_email text NOT NULL,
  cluster_id uuid REFERENCES public.health_cluster(id) ON DELETE SET NULL,
  target_tenant_type public.tenant_type NOT NULL DEFAULT 'partner',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','ready','failed','completed','cancelled')),
  notes text,
  handoff_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid REFERENCES auth.users(id),
  completed_tenant_id uuid REFERENCES public.corporate_accounts(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_provisioning_request TO authenticated;
GRANT ALL ON public.tenant_provisioning_request TO service_role;

ALTER TABLE public.tenant_provisioning_request ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin all" ON public.tenant_provisioning_request;
CREATE POLICY "superadmin all" ON public.tenant_provisioning_request
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::public.app_role));

CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_tpr_updated_at ON public.tenant_provisioning_request;
CREATE TRIGGER trg_tpr_updated_at BEFORE UPDATE ON public.tenant_provisioning_request
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

CREATE INDEX IF NOT EXISTS tpr_status_idx ON public.tenant_provisioning_request(status);
CREATE INDEX IF NOT EXISTS tpr_business_request_idx ON public.tenant_provisioning_request(business_request_id);

-- M-GR1-04 · Platform settings row for demo videos toggle
INSERT INTO public.platform_settings (key, value)
VALUES ('demo_videos_enabled', jsonb_build_object('enabled', false))
ON CONFLICT (key) DO NOTHING;

-- M-GR1-05 · Sandbox-tenant helper
CREATE OR REPLACE FUNCTION public.is_sandbox_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.corporate_accounts
    WHERE id = _tenant_id AND tenant_type = 'sandbox'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_sandbox_tenant(uuid) TO authenticated, service_role;