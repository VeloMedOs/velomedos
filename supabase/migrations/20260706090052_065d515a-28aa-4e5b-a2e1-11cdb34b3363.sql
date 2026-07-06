-- M11: Forms engine (form_def / clinical_form_instance / form_workflow_binding + forms_gate_open()).

CREATE TABLE public.form_def (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  schema jsonb NOT NULL,
  age_band jsonb NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  UNIQUE (tenant_id, code, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_def TO authenticated;
GRANT ALL ON public.form_def TO service_role;
ALTER TABLE public.form_def ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read form_def" ON public.form_def FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant admins manage form_def" ON public.form_def FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER trg_form_def_updated_at BEFORE UPDATE ON public.form_def
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.clinical_form_instance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  form_def_id uuid NOT NULL REFERENCES public.form_def(id) ON DELETE RESTRICT,
  encounter_id uuid NULL,
  admission_request_id uuid NULL,
  order_item_table text NULL,
  order_item_id uuid NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','cosigned','void')),
  answers jsonb NOT NULL DEFAULT '{}',
  assigned_role text NULL,
  submitted_by uuid NULL,
  submitted_at timestamptz NULL,
  cosigned_by uuid NULL,
  cosigned_at timestamptz NULL,
  due_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_form_instance TO authenticated;
GRANT ALL ON public.clinical_form_instance TO service_role;
ALTER TABLE public.clinical_form_instance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read clinical_form_instance" ON public.clinical_form_instance FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members manage clinical_form_instance" ON public.clinical_form_instance FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE INDEX clinical_form_instance_encounter_idx ON public.clinical_form_instance(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX clinical_form_instance_order_idx ON public.clinical_form_instance(order_item_table, order_item_id) WHERE order_item_id IS NOT NULL;
CREATE TRIGGER trg_clinical_form_instance_updated_at BEFORE UPDATE ON public.clinical_form_instance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.form_workflow_binding (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  form_def_id uuid NOT NULL REFERENCES public.form_def(id) ON DELETE CASCADE,
  encounter_class text NULL,
  module text NULL,
  trigger text NOT NULL CHECK (trigger IN ('pre','post')),
  assignee_role text NULL,
  mandatory boolean NOT NULL DEFAULT true,
  cosign_required boolean NOT NULL DEFAULT false,
  due_window_minutes integer NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_workflow_binding TO authenticated;
GRANT ALL ON public.form_workflow_binding TO service_role;
ALTER TABLE public.form_workflow_binding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read form_workflow_binding" ON public.form_workflow_binding FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant admins manage form_workflow_binding" ON public.form_workflow_binding FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER trg_form_workflow_binding_updated_at BEFORE UPDATE ON public.form_workflow_binding
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- forms_gate_open(): true iff every mandatory pre-trigger binding for the encounter has a submitted/cosigned instance.
CREATE OR REPLACE FUNCTION public.forms_gate_open(_encounter_id uuid, _order_item_table text DEFAULT NULL, _order_item_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _enc RECORD;
  _missing integer;
BEGIN
  SELECT * INTO _enc FROM public.encounter WHERE id = _encounter_id;
  IF NOT FOUND THEN RETURN true; END IF;

  SELECT COUNT(*) INTO _missing
    FROM public.form_workflow_binding b
   WHERE b.tenant_id = _enc.tenant_id
     AND b.active = true
     AND b.mandatory = true
     AND b.trigger = 'pre'
     AND (b.encounter_class IS NULL OR b.encounter_class = _enc.class)
     AND NOT EXISTS (
       SELECT 1 FROM public.clinical_form_instance i
        WHERE i.tenant_id = b.tenant_id
          AND i.form_def_id = b.form_def_id
          AND i.encounter_id = _encounter_id
          AND ( (_order_item_id IS NULL) OR
                (i.order_item_table = _order_item_table AND i.order_item_id = _order_item_id) OR
                (i.order_item_id IS NULL) )
          AND i.status IN ('submitted','cosigned')
     );
  RETURN _missing = 0;
END $$;

GRANT EXECUTE ON FUNCTION public.forms_gate_open(uuid, text, uuid) TO authenticated, service_role;