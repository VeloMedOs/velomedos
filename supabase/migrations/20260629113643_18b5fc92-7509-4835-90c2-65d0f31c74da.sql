
-- Phase 5 — Admission / Emergency / Discharge MDS

CREATE TABLE public.encounter_hospitalization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL UNIQUE REFERENCES public.encounter(id) ON DELETE CASCADE,
  admission_specialty text,
  admission_source text,
  origin text,
  intended_length_of_stay text,
  re_admission text,
  discharge_specialty text,
  discharge_disposition text,
  admitted_at timestamptz,
  discharged_at timestamptz,
  length_of_stay_days int,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encounter_hosp_tenant_idx ON public.encounter_hospitalization(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounter_hospitalization TO authenticated;
GRANT ALL ON public.encounter_hospitalization TO service_role;
ALTER TABLE public.encounter_hospitalization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hosp_tenant_select" ON public.encounter_hospitalization FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "hosp_tenant_insert" ON public.encounter_hospitalization FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "hosp_tenant_update" ON public.encounter_hospitalization FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "hosp_tenant_delete" ON public.encounter_hospitalization FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER trg_encounter_hosp_touch BEFORE UPDATE ON public.encounter_hospitalization FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.encounter_emergency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL UNIQUE REFERENCES public.encounter(id) ON DELETE CASCADE,
  triage_date timestamptz,
  triage_category text,
  emergency_arrival_code text,
  emergency_service_start timestamptz,
  emergency_department_disposition text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encounter_emer_tenant_idx ON public.encounter_emergency(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounter_emergency TO authenticated;
GRANT ALL ON public.encounter_emergency TO service_role;
ALTER TABLE public.encounter_emergency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emer_tenant_select" ON public.encounter_emergency FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "emer_tenant_insert" ON public.encounter_emergency FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "emer_tenant_update" ON public.encounter_emergency FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "emer_tenant_delete" ON public.encounter_emergency FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER trg_encounter_emer_touch BEFORE UPDATE ON public.encounter_emergency FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reconciliation: drop double-homed column
ALTER TABLE public.encounter DROP COLUMN IF EXISTS discharge_disposition;

-- Monotonic journey-state helpers
CREATE OR REPLACE FUNCTION public.encounter_journey_rank(_state text)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _state
    WHEN 'registered' THEN 0
    WHEN 'encounter_open' THEN 1
    WHEN 'clinically_documented' THEN 2
    WHEN 'investigations_ordered' THEN 3
    WHEN 'admitted' THEN 4
    WHEN 'discharged' THEN 5
    WHEN 'coded' THEN 6
    WHEN 'grouped' THEN 7
    WHEN 'claim_ready' THEN 8
    WHEN 'submitted' THEN 9
    WHEN 'void' THEN -1
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.encounter_advance_journey(_enc_id uuid, _to text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _cur text;
BEGIN
  SELECT journey_state INTO _cur FROM public.encounter WHERE id = _enc_id;
  IF _cur IS NULL THEN RETURN; END IF;
  IF public.encounter_journey_rank(_to) > public.encounter_journey_rank(_cur) THEN
    UPDATE public.encounter SET journey_state = _to WHERE id = _enc_id;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.hosp_after_iu()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.admitted_at IS NOT NULL AND NEW.discharged_at IS NOT NULL THEN
    NEW.length_of_stay_days := GREATEST(0, (NEW.discharged_at::date - NEW.admitted_at::date));
  ELSE
    NEW.length_of_stay_days := NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_hosp_compute_los
  BEFORE INSERT OR UPDATE ON public.encounter_hospitalization
  FOR EACH ROW EXECUTE FUNCTION public.hosp_after_iu();

CREATE OR REPLACE FUNCTION public.hosp_advance_journey()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.admitted_at IS NOT NULL THEN
    PERFORM public.encounter_advance_journey(NEW.encounter_id, 'admitted');
  END IF;
  IF NEW.discharged_at IS NOT NULL THEN
    PERFORM public.encounter_advance_journey(NEW.encounter_id, 'discharged');
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_hosp_advance
  AFTER INSERT OR UPDATE ON public.encounter_hospitalization
  FOR EACH ROW EXECUTE FUNCTION public.hosp_advance_journey();
