
-- =========================================================================
-- 1. Move demo passwords out of the broadly-readable demo_credentials table.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.demo_credential_secrets (
  email text PRIMARY KEY REFERENCES public.demo_credentials(email) ON DELETE CASCADE,
  password text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only the service role may touch this table. anon/authenticated get nothing.
REVOKE ALL ON public.demo_credential_secrets FROM PUBLIC;
REVOKE ALL ON public.demo_credential_secrets FROM anon;
REVOKE ALL ON public.demo_credential_secrets FROM authenticated;
GRANT ALL ON public.demo_credential_secrets TO service_role;
ALTER TABLE public.demo_credential_secrets ENABLE ROW LEVEL SECURITY;
-- No policies = no access from authenticated/anon even if grants are added.

-- Backfill from the existing plaintext column if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='demo_credentials' AND column_name='password'
  ) THEN
    INSERT INTO public.demo_credential_secrets (email, password, updated_at)
      SELECT email, password, COALESCE(updated_at, now())
        FROM public.demo_credentials
       WHERE password IS NOT NULL AND password <> ''
      ON CONFLICT (email) DO NOTHING;

    ALTER TABLE public.demo_credentials DROP COLUMN password;
  END IF;
END $$;

-- =========================================================================
-- 2. Stop returning webhook signing secrets in plaintext.
-- =========================================================================
ALTER TABLE public.webhook_subscriptions
  ADD COLUMN IF NOT EXISTS hashed_secret text,
  ADD COLUMN IF NOT EXISTS secret_prefix text;

-- Backfill: hash existing plaintext secrets with sha256.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='webhook_subscriptions' AND column_name='secret'
  ) THEN
    UPDATE public.webhook_subscriptions
       SET hashed_secret = encode(digest(secret, 'sha256'), 'hex'),
           secret_prefix = left(secret, 6)
     WHERE secret IS NOT NULL AND hashed_secret IS NULL;

    ALTER TABLE public.webhook_subscriptions DROP COLUMN secret;
  END IF;
END $$;

-- =========================================================================
-- 3. care_visits: scope SELECT policies by tenant so Realtime never crosses tenants.
-- =========================================================================
DROP POLICY IF EXISTS "caregiver reads own visits" ON public.care_visits;
DROP POLICY IF EXISTS "caregiver updates own visits" ON public.care_visits;
DROP POLICY IF EXISTS "homecare admins manage visits" ON public.care_visits;
DROP POLICY IF EXISTS "patient reads own visits" ON public.care_visits;

CREATE POLICY "caregiver reads own visits"
  ON public.care_visits FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid() AND public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "caregiver updates own visits"
  ON public.care_visits FOR UPDATE TO authenticated
  USING (caregiver_id = auth.uid() AND public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (caregiver_id = auth.uid() AND public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "homecare admins manage visits"
  ON public.care_visits FOR ALL TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'dispatcher'::app_role))
  )
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'dispatcher'::app_role))
  );

CREATE POLICY "patient reads own visits"
  ON public.care_visits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_recipients cr
       WHERE cr.id = care_visits.recipient_id
         AND cr.patient_id = auth.uid()
         AND cr.tenant_id  = care_visits.tenant_id
    )
  );

-- =========================================================================
-- 4. ops_workspace_settings: stop letting every authenticated user read it.
-- =========================================================================
DROP POLICY IF EXISTS "authenticated reads workspace settings" ON public.ops_workspace_settings;
-- 'portal staff all' already covers staff read+write, so no replacement is needed.

-- =========================================================================
-- 5. api_keys self-insert: require tenant membership when tenant_id is set.
-- =========================================================================
DROP POLICY IF EXISTS "apikeys self insert" ON public.api_keys;
CREATE POLICY "apikeys self insert"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (tenant_id IS NULL OR public.is_tenant_member(auth.uid(), tenant_id))
  );

-- =========================================================================
-- 6. Lock down internal SECURITY DEFINER helpers (trigger-only).
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.bump_site_content_version(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.site_content_bump_on_publish() FROM PUBLIC, anon, authenticated;
