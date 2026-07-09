
ALTER TABLE public.referral
  ADD COLUMN IF NOT EXISTS source_key text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS referral_source_key_uidx
  ON public.referral(tenant_id, source_key)
  WHERE source_key IS NOT NULL;

COMMENT ON COLUMN public.referral.source_key IS
  'Deterministic dedup key for auto-generated referrals. NULL for manually-authored.';

CREATE OR REPLACE VIEW public.v_pregnancy_episode_active
WITH (security_invoker=true) AS
SELECT
  eoc.id AS episode_id, eoc.tenant_id, eoc.beneficiary_id, eoc.start_date,
  (eoc.start_date + 280) AS edd_computed,
  GREATEST(0, LEAST(42, ((now()::date - eoc.start_date) / 7)::int)) AS weeks_gestation,
  CASE
    WHEN (now()::date - eoc.start_date) < 196 THEN 'Q4W'
    WHEN (now()::date - eoc.start_date) < 252 THEN 'Q2W'
    ELSE 'Q1W'
  END AS cadence_band
FROM public.episode_of_care eoc
WHERE eoc.status = 'active' AND eoc.care_type = 'pregnancy';

CREATE OR REPLACE FUNCTION public.resolve_maternity_protocol(_tenant uuid, _encounter uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mp.id
    FROM public.encounter e
    JOIN public.coverage c ON c.id = e.coverage_id
    JOIN public.maternity_protocol mp
      ON mp.tenant_id = _tenant AND mp.payer_id = c.payer_id AND mp.active
     AND (mp.policy_id IS NULL OR mp.policy_id = c.policy_id)
   WHERE e.id = _encounter AND e.tenant_id = _tenant
   ORDER BY (mp.policy_id IS NOT NULL) DESC, mp.created_at DESC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_maternity_protocol(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_maternity_protocol(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_nutrition_screening_form(_tenant uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _def_id uuid;
BEGIN
  SELECT id INTO _def_id FROM public.form_def
   WHERE tenant_id = _tenant AND code = 'NUTRITION_SCREEN_ANC' LIMIT 1;
  IF _def_id IS NOT NULL THEN RETURN _def_id; END IF;

  INSERT INTO public.form_def (tenant_id, code, title, version, schema, active)
  VALUES (_tenant, 'NUTRITION_SCREEN_ANC', 'Antenatal Nutrition Screening', 1,
          jsonb_build_object('fields', jsonb_build_array(
            jsonb_build_object('key','risk_score','type','enum','options',jsonb_build_array('low','moderate','high')))),
          true)
  RETURNING id INTO _def_id;

  INSERT INTO public.form_workflow_binding
    (tenant_id, form_def_id, encounter_class, module, trigger, assignee_role,
     mandatory, cosign_required, due_window_minutes, active, classification)
  VALUES (_tenant, _def_id, 'AMB', 'obs_gyn', 'pre', 'nurse', false, false, 60, true, 'nurse');

  RETURN _def_id;
END $$;

REVOKE ALL ON FUNCTION public.ensure_nutrition_screening_form(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_nutrition_screening_form(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_opd_nutrition_referral_candidate
WITH (security_invoker=true) AS
SELECT e.id AS encounter_id, e.tenant_id, e.beneficiary_id,
       cfi.id AS form_instance_id, (cfi.answers ->> 'risk_score') AS risk_score
FROM public.encounter e
JOIN public.v_pregnancy_episode_active peo
  ON peo.tenant_id = e.tenant_id AND peo.beneficiary_id = e.beneficiary_id
JOIN public.clinical_form_instance cfi
  ON cfi.tenant_id = e.tenant_id AND cfi.encounter_id = e.id
JOIN public.form_def fd ON fd.id = cfi.form_def_id AND fd.code ILIKE '%NUTRITION%SCREEN%'
WHERE cfi.status IN ('submitted','cosigned')
  AND (cfi.answers ->> 'risk_score') IN ('moderate','high');

CREATE OR REPLACE FUNCTION public.encounter_open_maybe_nutrition_referral()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _cand RECORD;
BEGIN
  SELECT encounter_id, beneficiary_id INTO _cand
    FROM public.v_opd_nutrition_referral_candidate
   WHERE tenant_id = NEW.tenant_id AND encounter_id = NEW.id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  BEGIN
    INSERT INTO public.referral (
      tenant_id, referral_no, beneficiary_id, source_encounter_id,
      referral_class, status, reason, source_specialty, source_key
    ) VALUES (
      NEW.tenant_id,
      'REF-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
      _cand.beneficiary_id, NEW.id,
      'internal', 'draft', 'nutrition_high_risk_pregnancy', 'nutrition',
      'nutrition_screen:' || NEW.id::text
    );
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_encounter_nutrition_referral ON public.encounter;
CREATE TRIGGER tg_encounter_nutrition_referral
  AFTER INSERT OR UPDATE OF journey_state ON public.encounter
  FOR EACH ROW WHEN (NEW.journey_state = 'encounter_open')
  EXECUTE FUNCTION public.encounter_open_maybe_nutrition_referral();

INSERT INTO public.service_master (tenant_id, internal_code, name, service_type, billing_type, execution_venue, active)
SELECT ca.id, 'NUTRITION_CONSULT', 'Nutrition Consultation', 'services', 'on_raising', 'clinic', true
  FROM public.corporate_accounts ca
 WHERE NOT EXISTS (
   SELECT 1 FROM public.service_master sm
    WHERE sm.tenant_id = ca.id AND sm.internal_code = 'NUTRITION_CONSULT'
 );
