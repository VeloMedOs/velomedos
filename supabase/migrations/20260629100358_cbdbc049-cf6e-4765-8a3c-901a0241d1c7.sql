
-- ============================================================
-- Phase 2 — Encounter + Diagnosis + Vitals + CareTeam
-- ============================================================

-- ---------- episode_of_care ----------
CREATE TABLE public.episode_of_care (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  care_type text,
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  primary_practitioner_id uuid,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX episode_of_care_tenant_ben_idx
  ON public.episode_of_care(tenant_id, beneficiary_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.episode_of_care TO authenticated;
GRANT ALL ON public.episode_of_care TO service_role;
ALTER TABLE public.episode_of_care ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eoc tenant members read"   ON public.episode_of_care FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "eoc tenant members insert" ON public.episode_of_care FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "eoc tenant members update" ON public.episode_of_care FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "eoc tenant members delete" ON public.episode_of_care FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER episode_of_care_touch BEFORE UPDATE ON public.episode_of_care
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- encounter ----------
CREATE TABLE public.encounter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  episode_of_care_id uuid REFERENCES public.episode_of_care(id) ON DELETE SET NULL,
  coverage_id uuid REFERENCES public.coverage(id) ON DELETE SET NULL,
  encounter_number text NOT NULL,
  class text NOT NULL CHECK (class IN ('AMB','EMER','IMP','HH','VR')),
  type text,
  service_type text,
  priority text,
  -- Clinical lifecycle (FHIR-aligned), driven by /encounters/:id/advance
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','arrived','triaged','in_progress','on_leave','finished','cancelled')),
  -- MDS / claim journey (Phase 5/6/7 own writes)
  journey_state text NOT NULL DEFAULT 'encounter_open',
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz,
  location_id uuid,
  reason_text text,
  chief_complaint text,
  -- Grouper / pricing inputs (populated at discharge in Phase 5, read by Phase 4/6)
  reimbursement_model text NOT NULL DEFAULT 'itemized_sbs'
    CHECK (reimbursement_model IN ('drg_bundled','itemized_sbs')),
  same_day boolean,
  mechanical_ventilation_hours int,
  separation_mode text,
  cause_of_death text,
  discharge_disposition text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, encounter_number)
);
CREATE INDEX encounter_tenant_ben_idx       ON public.encounter(tenant_id, beneficiary_id);
CREATE INDEX encounter_tenant_status_idx    ON public.encounter(tenant_id, status);
CREATE INDEX encounter_tenant_journey_idx   ON public.encounter(tenant_id, journey_state);
CREATE INDEX encounter_tenant_period_idx    ON public.encounter(tenant_id, period_start DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounter TO authenticated;
GRANT ALL ON public.encounter TO service_role;
ALTER TABLE public.encounter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encounter tenant members read"   ON public.encounter FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encounter tenant members insert" ON public.encounter FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encounter tenant members update" ON public.encounter FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encounter tenant members delete" ON public.encounter FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER encounter_touch BEFORE UPDATE ON public.encounter
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Encounter number sequence per tenant: ENC-YYYY-<6hex>
CREATE OR REPLACE FUNCTION public.encounter_set_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.encounter_number IS NULL OR NEW.encounter_number = '' THEN
    NEW.encounter_number := 'ENC-' || to_char(now(), 'YYYY') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END
$$;

-- Derive reimbursement_model from class on every insert/update of class
CREATE OR REPLACE FUNCTION public.encounter_set_reimbursement_model()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.reimbursement_model :=
    CASE WHEN upper(NEW.class) = 'IMP' THEN 'drg_bundled' ELSE 'itemized_sbs' END;
  RETURN NEW;
END
$$;

CREATE TRIGGER encounter_number_bi BEFORE INSERT ON public.encounter
  FOR EACH ROW EXECUTE FUNCTION public.encounter_set_number();
CREATE TRIGGER encounter_reimb_biu BEFORE INSERT OR UPDATE OF class ON public.encounter
  FOR EACH ROW EXECUTE FUNCTION public.encounter_set_reimbursement_model();

-- ---------- encounter_diagnosis ----------
CREATE TABLE public.encounter_diagnosis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  code_system text NOT NULL DEFAULT 'icd-10-am',
  code text NOT NULL,
  display text,
  role text NOT NULL DEFAULT 'admission'
    CHECK (role IN ('admission','principal','secondary','discharge','external_cause')),
  rank int,
  present_on_admission text CHECK (present_on_admission IS NULL OR present_on_admission IN ('Y','N','U','W')),
  is_chronic boolean DEFAULT false,
  onset_date date,
  recorded_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX enc_dx_tenant_enc_role_idx ON public.encounter_diagnosis(tenant_id, encounter_id, role);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounter_diagnosis TO authenticated;
GRANT ALL ON public.encounter_diagnosis TO service_role;
ALTER TABLE public.encounter_diagnosis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encdx tenant members read"   ON public.encounter_diagnosis FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encdx tenant members insert" ON public.encounter_diagnosis FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encdx tenant members update" ON public.encounter_diagnosis FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encdx tenant members delete" ON public.encounter_diagnosis FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER encounter_diagnosis_touch BEFORE UPDATE ON public.encounter_diagnosis
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- encounter_care_team ----------
CREATE TABLE public.encounter_care_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  practitioner_user_id uuid NOT NULL,
  role text NOT NULL,
  is_primary boolean DEFAULT false,
  period_start timestamptz DEFAULT now(),
  period_end timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, practitioner_user_id, role)
);
CREATE INDEX enc_ct_tenant_enc_idx ON public.encounter_care_team(tenant_id, encounter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounter_care_team TO authenticated;
GRANT ALL ON public.encounter_care_team TO service_role;
ALTER TABLE public.encounter_care_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encct tenant members read"   ON public.encounter_care_team FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encct tenant members insert" ON public.encounter_care_team FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encct tenant members update" ON public.encounter_care_team FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "encct tenant members delete" ON public.encounter_care_team FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER encounter_care_team_touch BEFORE UPDATE ON public.encounter_care_team
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- vitals_observation ----------
CREATE TABLE public.vitals_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  body_position text,
  body_site text,
  temperature_c numeric(4,1),
  heart_rate_bpm int,
  respiratory_rate_bpm int,
  systolic_mmhg int,
  diastolic_mmhg int,
  spo2_pct numeric(4,1),
  pain_score int CHECK (pain_score IS NULL OR (pain_score BETWEEN 0 AND 10)),
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  bmi numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN height_cm > 0 AND weight_kg IS NOT NULL
         THEN round((weight_kg / ((height_cm/100.0)^2))::numeric, 2)
         ELSE NULL END
  ) STORED,
  glucose_mmol_l numeric(5,2),
  news2_score int,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vitals_tenant_ben_time_idx ON public.vitals_observation(tenant_id, beneficiary_id, recorded_at DESC);
CREATE INDEX vitals_enc_time_idx       ON public.vitals_observation(encounter_id, recorded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vitals_observation TO authenticated;
GRANT ALL ON public.vitals_observation TO service_role;
ALTER TABLE public.vitals_observation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vitals tenant members read"   ON public.vitals_observation FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "vitals tenant members insert" ON public.vitals_observation FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "vitals tenant members update" ON public.vitals_observation FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "vitals tenant members delete" ON public.vitals_observation FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER vitals_observation_touch BEFORE UPDATE ON public.vitals_observation
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- clinical_supporting_info ----------
CREATE TABLE public.clinical_supporting_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'history_of_present_illness',
    'physical_examination',
    'treatment_plan',
    'patient_history',
    'investigation_result',
    'other'
  )),
  value_text text,
  value_code text,
  code_system text,
  value_attachment_url text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid,
  sequence int,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX csi_tenant_enc_cat_idx ON public.clinical_supporting_info(tenant_id, encounter_id, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_supporting_info TO authenticated;
GRANT ALL ON public.clinical_supporting_info TO service_role;
ALTER TABLE public.clinical_supporting_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csi tenant members read"   ON public.clinical_supporting_info FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "csi tenant members insert" ON public.clinical_supporting_info FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "csi tenant members update" ON public.clinical_supporting_info FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "csi tenant members delete" ON public.clinical_supporting_info FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER clinical_supporting_info_touch BEFORE UPDATE ON public.clinical_supporting_info
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- Auto-advance journey_state to clinically_documented ----------
-- Fires after a principal diagnosis is written; if the encounter also has a
-- chief_complaint (or HPI in supporting info), bump it forward.
CREATE OR REPLACE FUNCTION public.encounter_maybe_advance_documented(_enc_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _enc RECORD;
  _has_principal boolean;
  _has_hpi boolean;
BEGIN
  SELECT * INTO _enc FROM public.encounter WHERE id = _enc_id;
  IF NOT FOUND OR _enc.journey_state <> 'encounter_open' THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM public.encounter_diagnosis
                  WHERE encounter_id = _enc_id AND role = 'principal')
    INTO _has_principal;
  SELECT EXISTS (SELECT 1 FROM public.clinical_supporting_info
                  WHERE encounter_id = _enc_id AND category = 'history_of_present_illness')
    INTO _has_hpi;

  IF _has_principal AND (_enc.chief_complaint IS NOT NULL OR _has_hpi) THEN
    UPDATE public.encounter
       SET journey_state = 'clinically_documented'
     WHERE id = _enc_id AND journey_state = 'encounter_open';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.encounter_diagnosis_after_iu()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.encounter_maybe_advance_documented(NEW.encounter_id);
  RETURN NEW;
END $$;
CREATE TRIGGER encdx_advance_journey AFTER INSERT OR UPDATE ON public.encounter_diagnosis
  FOR EACH ROW EXECUTE FUNCTION public.encounter_diagnosis_after_iu();

CREATE OR REPLACE FUNCTION public.csi_after_iu()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.encounter_maybe_advance_documented(NEW.encounter_id);
  RETURN NEW;
END $$;
CREATE TRIGGER csi_advance_journey AFTER INSERT OR UPDATE ON public.clinical_supporting_info
  FOR EACH ROW EXECUTE FUNCTION public.csi_after_iu();
