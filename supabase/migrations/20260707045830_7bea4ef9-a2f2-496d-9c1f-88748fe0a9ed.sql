
-- Turn 2a · Clinical Spine — schema extensions, triggers, ICU seed, visit_source enum
ALTER TABLE public.encounter
  ADD COLUMN IF NOT EXISTS dnr_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS isolation_precaution text NULL;
COMMENT ON COLUMN public.encounter.dnr_flag IS
  'Stub for DNR display; full clinical-attestation model deferred to Batch C. Do not use for clinical decisions without attestation.';

ALTER TABLE public.beneficiary
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;

ALTER TABLE public.form_workflow_binding
  ADD COLUMN IF NOT EXISTS order_item_table text NULL,
  ADD COLUMN IF NOT EXISTS service_id uuid NULL REFERENCES public.service_master(id);

ALTER TABLE public.clinical_form_instance
  ADD COLUMN IF NOT EXISTS paste_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addenda jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cosign_pending_for uuid NULL;

CREATE OR REPLACE FUNCTION public._order_item_encounter(_tbl text, _order_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _tbl
    WHEN 'lab_order_item'       THEN (SELECT encounter_id FROM public.lab_order WHERE id = _order_id)
    WHEN 'radiology_order_item' THEN (SELECT encounter_id FROM public.radiology_order WHERE id = _order_id)
    WHEN 'service_order_item'   THEN (SELECT encounter_id FROM public.service_order WHERE id = _order_id)
    WHEN 'ep_order_item'        THEN (SELECT encounter_id FROM public.electrophysiology_order WHERE id = _order_id)
    WHEN 'prescription_item'    THEN (SELECT encounter_id FROM public.prescription WHERE id = _order_id)
  END
$$;

CREATE OR REPLACE FUNCTION public.enforce_forms_gate_on_order_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _enc_id uuid;
BEGIN
  _enc_id := public._order_item_encounter(TG_TABLE_NAME, NEW.order_id);
  IF _enc_id IS NULL THEN RETURN NEW; END IF;
  IF NOT public.forms_gate_open(_enc_id, TG_TABLE_NAME, NULL) THEN
    RAISE EXCEPTION 'forms_gate: mandatory pre-order forms not submitted'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lab_order_item_forms_gate_before_insert ON public.lab_order_item;
CREATE TRIGGER lab_order_item_forms_gate_before_insert
  BEFORE INSERT ON public.lab_order_item FOR EACH ROW EXECUTE FUNCTION public.enforce_forms_gate_on_order_item();
DROP TRIGGER IF EXISTS radiology_order_item_forms_gate_before_insert ON public.radiology_order_item;
CREATE TRIGGER radiology_order_item_forms_gate_before_insert
  BEFORE INSERT ON public.radiology_order_item FOR EACH ROW EXECUTE FUNCTION public.enforce_forms_gate_on_order_item();
DROP TRIGGER IF EXISTS service_order_item_forms_gate_before_insert ON public.service_order_item;
CREATE TRIGGER service_order_item_forms_gate_before_insert
  BEFORE INSERT ON public.service_order_item FOR EACH ROW EXECUTE FUNCTION public.enforce_forms_gate_on_order_item();
DROP TRIGGER IF EXISTS ep_order_item_forms_gate_before_insert ON public.ep_order_item;
CREATE TRIGGER ep_order_item_forms_gate_before_insert
  BEFORE INSERT ON public.ep_order_item FOR EACH ROW EXECUTE FUNCTION public.enforce_forms_gate_on_order_item();
DROP TRIGGER IF EXISTS prescription_item_forms_gate_before_insert ON public.prescription_item;
CREATE TRIGGER prescription_item_forms_gate_before_insert
  BEFORE INSERT ON public.prescription_item FOR EACH ROW EXECUTE FUNCTION public.enforce_forms_gate_on_order_item();

CREATE OR REPLACE FUNCTION public.instantiate_post_order_forms()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _enc_id uuid; _enc_class text; _svc_id uuid;
BEGIN
  _enc_id := public._order_item_encounter(TG_TABLE_NAME, NEW.order_id);
  IF _enc_id IS NULL THEN RETURN NEW; END IF;
  SELECT class INTO _enc_class FROM public.encounter WHERE id = _enc_id;
  BEGIN
    EXECUTE format('SELECT ($1).service_id') INTO _svc_id USING NEW;
  EXCEPTION WHEN others THEN
    _svc_id := NULL;
  END;
  INSERT INTO public.clinical_form_instance
    (tenant_id, form_def_id, encounter_id, order_item_table, order_item_id, status, assigned_role, due_at)
  SELECT b.tenant_id, b.form_def_id, _enc_id, TG_TABLE_NAME, NEW.id, 'draft', b.assignee_role,
         now() + make_interval(mins => COALESCE(b.due_window_minutes, 60))
    FROM public.form_workflow_binding b
   WHERE b.active
     AND b.trigger = 'post'
     AND (b.encounter_class IS NULL OR b.encounter_class = _enc_class)
     AND (b.order_item_table IS NULL OR b.order_item_table = TG_TABLE_NAME)
     AND (b.service_id IS NULL OR b.service_id = _svc_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS lab_order_item_post_order_instantiate ON public.lab_order_item;
CREATE TRIGGER lab_order_item_post_order_instantiate
  AFTER INSERT ON public.lab_order_item FOR EACH ROW EXECUTE FUNCTION public.instantiate_post_order_forms();
DROP TRIGGER IF EXISTS radiology_order_item_post_order_instantiate ON public.radiology_order_item;
CREATE TRIGGER radiology_order_item_post_order_instantiate
  AFTER INSERT ON public.radiology_order_item FOR EACH ROW EXECUTE FUNCTION public.instantiate_post_order_forms();
DROP TRIGGER IF EXISTS service_order_item_post_order_instantiate ON public.service_order_item;
CREATE TRIGGER service_order_item_post_order_instantiate
  AFTER INSERT ON public.service_order_item FOR EACH ROW EXECUTE FUNCTION public.instantiate_post_order_forms();
DROP TRIGGER IF EXISTS ep_order_item_post_order_instantiate ON public.ep_order_item;
CREATE TRIGGER ep_order_item_post_order_instantiate
  AFTER INSERT ON public.ep_order_item FOR EACH ROW EXECUTE FUNCTION public.instantiate_post_order_forms();
DROP TRIGGER IF EXISTS prescription_item_post_order_instantiate ON public.prescription_item;
CREATE TRIGGER prescription_item_post_order_instantiate
  AFTER INSERT ON public.prescription_item FOR EACH ROW EXECUTE FUNCTION public.instantiate_post_order_forms();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_source') THEN
    CREATE TYPE public.visit_source AS ENUM ('walk_in','scheduled','er_referral','ip_followup');
  END IF;
END $$;

DO $$
DECLARE _t record; _svc uuid; _def uuid;
BEGIN
  FOR _t IN SELECT id FROM public.corporate_accounts LOOP
    SELECT id INTO _svc FROM public.service_master
      WHERE tenant_id = _t.id AND internal_code = 'ICU_ADMISSION' LIMIT 1;
    IF _svc IS NULL THEN
      INSERT INTO public.service_master (tenant_id, internal_code, name, service_type, category, description)
      VALUES (_t.id, 'ICU_ADMISSION', 'ICU Admission', 'procedures', 'inpatient',
              'ICU admission service — triggers mandatory ICU admission checklist form.')
      RETURNING id INTO _svc;
    END IF;
    SELECT id INTO _def FROM public.form_def
      WHERE tenant_id = _t.id AND code = 'ICU_ADMISSION_CHECKLIST' LIMIT 1;
    IF _def IS NULL THEN
      INSERT INTO public.form_def (tenant_id, code, title, schema)
      VALUES (_t.id, 'ICU_ADMISSION_CHECKLIST', 'ICU Admission Checklist',
              '{"fields":[
                {"id":"indication","label":"Indication for ICU admission","type":"text","required":true},
                {"id":"consent_obtained","label":"Consent obtained","type":"boolean","required":true},
                {"id":"isolation","label":"Isolation precaution","type":"text"},
                {"id":"initial_vitals","label":"Initial vitals recorded","type":"boolean","required":true}
              ]}'::jsonb)
      RETURNING id INTO _def;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.form_workflow_binding
       WHERE tenant_id = _t.id AND form_def_id = _def AND trigger = 'pre'
         AND encounter_class = 'IMP' AND service_id = _svc
    ) THEN
      INSERT INTO public.form_workflow_binding
        (tenant_id, form_def_id, encounter_class, trigger, service_id, order_item_table, mandatory, active)
      VALUES (_t.id, _def, 'IMP', 'pre', _svc, 'service_order_item', true, true);
    END IF;
  END LOOP;
END $$;
