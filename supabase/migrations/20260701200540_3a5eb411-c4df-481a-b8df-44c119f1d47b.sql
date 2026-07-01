
-- 1. Widen claim.status CHECK to 14 lifecycle states (kept as CHECK, not enum)
ALTER TABLE public.claim DROP CONSTRAINT IF EXISTS claim_status_check;
ALTER TABLE public.claim ADD CONSTRAINT claim_status_check CHECK (status IN (
  'draft','assembled','scrubbing','scrub_failed','ready','auth_hold','coding_hold',
  'priced','submitted','accepted','rejected','resubmit_required','adjudicated','closed'
));

-- Advisory-lock columns (mirror R2 pattern)
ALTER TABLE public.claim
  ADD COLUMN IF NOT EXISTS locked_by uuid,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- Refresh partial unique index so newly-lifecycled states still block dup active claim per encounter
DROP INDEX IF EXISTS claim_one_active_per_encounter;
CREATE UNIQUE INDEX claim_one_active_per_encounter ON public.claim (encounter_id)
  WHERE status IN ('draft','assembled','scrubbing','scrub_failed','ready','auth_hold','coding_hold','priced','submitted','accepted');

-- 2. claim_lifecycle_event — audit
CREATE TABLE IF NOT EXISTS public.claim_lifecycle_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid,
  reason text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_lifecycle_event_claim_idx ON public.claim_lifecycle_event (claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS claim_lifecycle_event_tenant_idx ON public.claim_lifecycle_event (tenant_id, created_at DESC);
GRANT SELECT, INSERT ON public.claim_lifecycle_event TO authenticated;
GRANT ALL ON public.claim_lifecycle_event TO service_role;
ALTER TABLE public.claim_lifecycle_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_lifecycle_event_tenant_read ON public.claim_lifecycle_event
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY claim_lifecycle_event_tenant_insert ON public.claim_lifecycle_event
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

-- 3. claim_scrub_result — history of scrub runs
CREATE TABLE IF NOT EXISTS public.claim_scrub_result (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  blocker_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  hash text
);
CREATE INDEX IF NOT EXISTS claim_scrub_result_claim_idx ON public.claim_scrub_result (claim_id, run_at DESC);
CREATE INDEX IF NOT EXISTS claim_scrub_result_tenant_idx ON public.claim_scrub_result (tenant_id, run_at DESC);
GRANT SELECT, INSERT ON public.claim_scrub_result TO authenticated;
GRANT ALL ON public.claim_scrub_result TO service_role;
ALTER TABLE public.claim_scrub_result ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_scrub_result_tenant_read ON public.claim_scrub_result
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY claim_scrub_result_tenant_insert ON public.claim_scrub_result
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

-- 4. scrub_rule master (direct CRUD, not change-request)
CREATE TABLE IF NOT EXISTS public.scrub_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  severity text NOT NULL DEFAULT 'blocker' CHECK (severity IN ('blocker','warning','info')),
  category text,
  enabled boolean NOT NULL DEFAULT true,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date,
  effective_to date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scrub_rule TO authenticated;
GRANT ALL ON public.scrub_rule TO service_role;
ALTER TABLE public.scrub_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY scrub_rule_tenant_read ON public.scrub_rule
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY scrub_rule_tenant_write ON public.scrub_rule
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER scrub_rule_touch BEFORE UPDATE ON public.scrub_rule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. submission_channel master — payer submission endpoint config
CREATE TABLE IF NOT EXISTS public.submission_channel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  payer_id uuid,
  label text NOT NULL,
  channel_kind text NOT NULL DEFAULT 'nphies' CHECK (channel_kind IN ('nphies','tpa_portal','manual','sandbox')),
  endpoint text,
  active boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS submission_channel_tenant_idx ON public.submission_channel (tenant_id, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_channel TO authenticated;
GRANT ALL ON public.submission_channel TO service_role;
ALTER TABLE public.submission_channel ENABLE ROW LEVEL SECURITY;
CREATE POLICY submission_channel_tenant_read ON public.submission_channel
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY submission_channel_tenant_write ON public.submission_channel
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER submission_channel_touch BEFORE UPDATE ON public.submission_channel
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Refresh trigger — touch draft/assembled claims when auth status or auth-item decision changes
CREATE OR REPLACE FUNCTION public.claim_refresh_on_auth_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _enc uuid;
BEGIN
  IF TG_TABLE_NAME = 'authorization_request' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      _enc := NEW.encounter_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'authorization_item' THEN
    IF NEW.decision IS DISTINCT FROM OLD.decision THEN
      SELECT encounter_id INTO _enc FROM public.authorization_request WHERE id = NEW.authorization_request_id;
    END IF;
  END IF;
  IF _enc IS NOT NULL THEN
    UPDATE public.claim
       SET updated_at = now()
     WHERE encounter_id = _enc
       AND status IN ('draft','assembled','scrubbing','scrub_failed','ready','auth_hold','coding_hold','priced');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS claim_refresh_on_auth_status ON public.authorization_request;
CREATE TRIGGER claim_refresh_on_auth_status
  AFTER UPDATE ON public.authorization_request
  FOR EACH ROW EXECUTE FUNCTION public.claim_refresh_on_auth_change();

DROP TRIGGER IF EXISTS claim_refresh_on_auth_item ON public.authorization_item;
CREATE TRIGGER claim_refresh_on_auth_item
  AFTER UPDATE ON public.authorization_item
  FOR EACH ROW EXECUTE FUNCTION public.claim_refresh_on_auth_change();
