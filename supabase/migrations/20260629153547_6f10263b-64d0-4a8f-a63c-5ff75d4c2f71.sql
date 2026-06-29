
-- =========================================================================
-- Phase 11 — VBHC PROMs / PREMs
-- =========================================================================

CREATE TABLE public.prom_instrument (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('generic','disease_specific','experience')),
  condition text NULL CHECK (condition IS NULL OR condition IN ('cataract','obesity','diabetes','pregnancy','other')),
  version text NOT NULL DEFAULT '1.0',
  active boolean NOT NULL DEFAULT true,
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prom_instrument TO authenticated;
GRANT ALL ON public.prom_instrument TO service_role;

ALTER TABLE public.prom_instrument ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prom_instrument_read" ON public.prom_instrument FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "prom_instrument_write_tenant" ON public.prom_instrument FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "prom_instrument_superadmin" ON public.prom_instrument FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER prom_instrument_touch BEFORE UPDATE ON public.prom_instrument
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.prom_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  episode_of_care_id uuid NULL REFERENCES public.episode_of_care(id) ON DELETE SET NULL,
  encounter_id uuid NULL REFERENCES public.encounter(id) ON DELETE SET NULL,
  instrument_id uuid NOT NULL REFERENCES public.prom_instrument(id),
  trigger text NOT NULL CHECK (trigger IN ('pre_op','post_op','baseline','followup')),
  due_at timestamptz NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','expired','cancelled')),
  channel text NOT NULL DEFAULT 'app' CHECK (channel IN ('app','sms','portal')),
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminder_at timestamptz NULL,
  assigned_by uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prom_assignment_tenant_idx ON public.prom_assignment(tenant_id, status);
CREATE INDEX prom_assignment_beneficiary_idx ON public.prom_assignment(beneficiary_id);
CREATE INDEX prom_assignment_episode_idx ON public.prom_assignment(episode_of_care_id) WHERE episode_of_care_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prom_assignment TO authenticated;
GRANT ALL ON public.prom_assignment TO service_role;
ALTER TABLE public.prom_assignment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prom_assignment_tenant" ON public.prom_assignment FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "prom_assignment_superadmin" ON public.prom_assignment FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "prom_assignment_beneficiary_read" ON public.prom_assignment FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.beneficiary b
                 WHERE b.id = beneficiary_id AND b.patient_user_id = auth.uid()));

CREATE TRIGGER prom_assignment_touch BEFORE UPDATE ON public.prom_assignment
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.prom_response (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.prom_assignment(id) ON DELETE CASCADE,
  instrument_version text NOT NULL,
  answers jsonb NOT NULL,
  score jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'portal' CHECK (source IN ('patient_app','sms','portal','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prom_response_tenant_idx ON public.prom_response(tenant_id, collected_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prom_response TO authenticated;
GRANT ALL ON public.prom_response TO service_role;
ALTER TABLE public.prom_response ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prom_response_tenant" ON public.prom_response FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "prom_response_superadmin" ON public.prom_response FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "prom_response_beneficiary" ON public.prom_response FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prom_assignment pa
                 JOIN public.beneficiary b ON b.id = pa.beneficiary_id
                 WHERE pa.id = assignment_id AND b.patient_user_id = auth.uid()));

CREATE TRIGGER prom_response_touch BEFORE UPDATE ON public.prom_response
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.prom_response_complete_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.prom_assignment
     SET status = 'completed'
   WHERE id = NEW.assignment_id AND status <> 'completed';
  RETURN NEW;
END $$;

CREATE TRIGGER prom_response_complete AFTER INSERT ON public.prom_response
  FOR EACH ROW EXECUTE FUNCTION public.prom_response_complete_assignment();

CREATE TABLE public.prem_response (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid NULL REFERENCES public.encounter(id) ON DELETE SET NULL,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES public.prom_instrument(id),
  instrument_version text NOT NULL,
  answers jsonb NOT NULL,
  score jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'portal' CHECK (source IN ('patient_app','sms','portal','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prem_response_tenant_idx ON public.prem_response(tenant_id, collected_at DESC);
CREATE INDEX prem_response_encounter_idx ON public.prem_response(encounter_id) WHERE encounter_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prem_response TO authenticated;
GRANT ALL ON public.prem_response TO service_role;
ALTER TABLE public.prem_response ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prem_response_tenant" ON public.prem_response FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "prem_response_superadmin" ON public.prem_response FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "prem_response_beneficiary" ON public.prem_response FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.beneficiary b
                 WHERE b.id = beneficiary_id AND b.patient_user_id = auth.uid()));

CREATE TRIGGER prem_response_touch BEFORE UPDATE ON public.prem_response
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.nphies_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  subject_table text NULL,
  subject_id uuid NULL,
  idempotency_key text NOT NULL,
  sandbox boolean NOT NULL DEFAULT true,
  http_status integer NULL,
  outcome text NOT NULL CHECK (outcome IN ('in_flight','ok','error')),
  request_body jsonb NULL,
  response_body jsonb NULL,
  error text NULL,
  actor_id uuid NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nphies_message_log_tenant_idx ON public.nphies_message_log(tenant_id, message_type, started_at DESC);
CREATE INDEX nphies_message_log_subject_idx ON public.nphies_message_log(subject_table, subject_id) WHERE subject_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nphies_message_log TO authenticated;
GRANT ALL ON public.nphies_message_log TO service_role;
ALTER TABLE public.nphies_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nphies_message_log_tenant_read" ON public.nphies_message_log FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

-- ---------- Seeds (platform-scope) ----------
INSERT INTO public.prom_instrument (tenant_id, key, name, kind, condition, version, description, schema) VALUES
(NULL, 'promis-10', 'PROMIS-10 Global Health', 'generic', NULL, '1.2',
 'Generic patient-reported global physical and mental health (PROMIS-10).',
 '{"items":[
  {"id":"global01","label":"In general, would you say your health is:","type":"scale","min":1,"max":5,"required":true,"domain":"general"},
  {"id":"global02","label":"In general, would you say your quality of life is:","type":"scale","min":1,"max":5,"required":true,"domain":"mental"},
  {"id":"global03","label":"In general, how would you rate your physical health?","type":"scale","min":1,"max":5,"required":true,"domain":"physical"},
  {"id":"global04","label":"In general, how would you rate your mental health, including your mood and your ability to think?","type":"scale","min":1,"max":5,"required":true,"domain":"mental"},
  {"id":"global05","label":"In general, how would you rate your satisfaction with your social activities and relationships?","type":"scale","min":1,"max":5,"required":true,"domain":"mental"},
  {"id":"global06","label":"In general, please rate how well you carry out your usual social activities and roles.","type":"scale","min":1,"max":5,"required":true,"domain":"physical"},
  {"id":"global07","label":"To what extent are you able to carry out your everyday physical activities?","type":"scale","min":1,"max":5,"required":true,"domain":"physical"},
  {"id":"global08","label":"In the past 7 days, how often have you been bothered by emotional problems?","type":"scale","min":1,"max":5,"required":true,"reverse":true,"domain":"mental"},
  {"id":"global09","label":"In the past 7 days, how would you rate your fatigue on average?","type":"scale","min":1,"max":5,"required":true,"reverse":true,"domain":"physical"},
  {"id":"global10","label":"In the past 7 days, how would you rate your pain on average?","type":"scale","min":0,"max":10,"required":true,"reverse":true,"domain":"physical"}
 ],"scoring":"promis10"}'::jsonb),
(NULL, 'cataract-prom', 'Cataract PROM (VF composite)', 'disease_specific', 'cataract', '1.0',
 'Vision-function composite for cataract patients (simplified).',
 '{"items":[
  {"id":"vf1","label":"Difficulty reading small print","type":"scale","min":1,"max":5,"required":true},
  {"id":"vf2","label":"Difficulty recognizing faces","type":"scale","min":1,"max":5,"required":true},
  {"id":"vf3","label":"Difficulty driving at night","type":"scale","min":1,"max":5,"required":true},
  {"id":"vf4","label":"Difficulty watching TV","type":"scale","min":1,"max":5,"required":true},
  {"id":"vf5","label":"Overall satisfaction with vision","type":"scale","min":1,"max":5,"required":true,"reverse":true}
 ],"scoring":"cataract_vf"}'::jsonb),
(NULL, 'prem-generic', 'Generic Patient Experience (PREM)', 'experience', NULL, '1.0',
 'Generic CAHPS-style patient experience instrument.',
 '{"items":[
  {"id":"px1","label":"How would you rate this care visit overall?","type":"scale","min":0,"max":10,"required":true,"domain":"overall"},
  {"id":"px2","label":"Staff treated you with respect","type":"scale","min":1,"max":5,"required":true,"domain":"respect"},
  {"id":"px3","label":"Information was explained clearly","type":"scale","min":1,"max":5,"required":true,"domain":"communication"},
  {"id":"px4","label":"You were involved in decisions about your care","type":"scale","min":1,"max":5,"required":true,"domain":"shared_decision"},
  {"id":"px5","label":"You would recommend this provider","type":"scale","min":1,"max":5,"required":true,"domain":"recommend"}
 ],"scoring":"prem_generic"}'::jsonb);
