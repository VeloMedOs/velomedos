
-- ===== Phase 4 enums =====
DO $$ BEGIN
  CREATE TYPE public.charge_pricing_mode AS ENUM ('cash','insured','drg_bundled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.charge_status AS ENUM ('ordered','collected','in_progress','resulted','dispensed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.clinical_order_status AS ENUM ('ordered','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pricing_rule_scope AS ENUM ('eligibility','share','package','substitution','drg_outlier','out_of_network');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.preauth_status AS ENUM ('not_required','pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Common: header columns macro (we just inline) =====
-- Each *_order header shares: tenant_id, encounter_id, status, ordered_by, ordered_at,
-- notes, preauth_required, preauth_ref, preauth_status, created/updated.

-- ===== lab_order =====
CREATE TABLE public.lab_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  status public.clinical_order_status NOT NULL DEFAULT 'ordered',
  priority text,
  notes text,
  ordered_by uuid,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  preauth_required boolean NOT NULL DEFAULT false,
  preauth_ref text,
  preauth_status public.preauth_status,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_order_enc ON public.lab_order(encounter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_order TO authenticated;
GRANT ALL ON public.lab_order TO service_role;
ALTER TABLE public.lab_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_order tenant rw" ON public.lab_order FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TABLE public.lab_order_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.lab_order(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.service_master(id),
  loinc_code text,
  specimen text,
  result_value text,
  result_unit text,
  result_status text,
  result_at timestamptz,
  status public.charge_status NOT NULL DEFAULT 'ordered',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_order_item_order ON public.lab_order_item(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_order_item TO authenticated;
GRANT ALL ON public.lab_order_item TO service_role;
ALTER TABLE public.lab_order_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_order_item tenant rw" ON public.lab_order_item FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ===== radiology_order =====
CREATE TABLE public.radiology_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  status public.clinical_order_status NOT NULL DEFAULT 'ordered',
  priority text,
  notes text,
  ordered_by uuid,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  preauth_required boolean NOT NULL DEFAULT false,
  preauth_ref text,
  preauth_status public.preauth_status,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_radiology_order_enc ON public.radiology_order(encounter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radiology_order TO authenticated;
GRANT ALL ON public.radiology_order TO service_role;
ALTER TABLE public.radiology_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY "radiology_order tenant rw" ON public.radiology_order FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TABLE public.radiology_order_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.radiology_order(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.service_master(id),
  modality text,
  body_site text,
  report_text text,
  report_status text,
  performed_at timestamptz,
  status public.charge_status NOT NULL DEFAULT 'ordered',
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_radiology_order_item_order ON public.radiology_order_item(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radiology_order_item TO authenticated;
GRANT ALL ON public.radiology_order_item TO service_role;
ALTER TABLE public.radiology_order_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "radiology_order_item tenant rw" ON public.radiology_order_item FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ===== electrophysiology_order =====
CREATE TABLE public.electrophysiology_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  status public.clinical_order_status NOT NULL DEFAULT 'ordered',
  priority text, notes text,
  ordered_by uuid,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  preauth_required boolean NOT NULL DEFAULT false,
  preauth_ref text,
  preauth_status public.preauth_status,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ep_order_enc ON public.electrophysiology_order(encounter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electrophysiology_order TO authenticated;
GRANT ALL ON public.electrophysiology_order TO service_role;
ALTER TABLE public.electrophysiology_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_order tenant rw" ON public.electrophysiology_order FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TABLE public.ep_order_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.electrophysiology_order(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.service_master(id),
  study_type text,
  interpretation text,
  performed_at timestamptz,
  status public.charge_status NOT NULL DEFAULT 'ordered',
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ep_order_item_order ON public.ep_order_item(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_order_item TO authenticated;
GRANT ALL ON public.ep_order_item TO service_role;
ALTER TABLE public.ep_order_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_order_item tenant rw" ON public.ep_order_item FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ===== service_order =====
CREATE TABLE public.service_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  status public.clinical_order_status NOT NULL DEFAULT 'ordered',
  priority text, notes text,
  ordered_by uuid,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  preauth_required boolean NOT NULL DEFAULT false,
  preauth_ref text,
  preauth_status public.preauth_status,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_order_enc ON public.service_order(encounter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order TO authenticated;
GRANT ALL ON public.service_order TO service_role;
ALTER TABLE public.service_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_order tenant rw" ON public.service_order FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TABLE public.service_order_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.service_order(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.service_master(id),
  quantity numeric NOT NULL DEFAULT 1,
  body_site text,
  performed_at timestamptz,
  notes text,
  status public.charge_status NOT NULL DEFAULT 'ordered',
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_order_item_order ON public.service_order_item(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_item TO authenticated;
GRANT ALL ON public.service_order_item TO service_role;
ALTER TABLE public.service_order_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_order_item tenant rw" ON public.service_order_item FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ===== prescription =====
CREATE TABLE public.prescription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  status public.clinical_order_status NOT NULL DEFAULT 'ordered',
  notes text,
  ordered_by uuid,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  preauth_required boolean NOT NULL DEFAULT false,
  preauth_ref text,
  preauth_status public.preauth_status,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prescription_enc ON public.prescription(encounter_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription TO authenticated;
GRANT ALL ON public.prescription TO service_role;
ALTER TABLE public.prescription ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescription tenant rw" ON public.prescription FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TABLE public.prescription_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.prescription(id) ON DELETE CASCADE,
  drug_id uuid NOT NULL REFERENCES public.drug_master(id),
  dose text,
  frequency text,
  duration text,
  quantity numeric NOT NULL DEFAULT 1,
  quantity_code text,
  selection_reason text,
  substitute_drug_id uuid REFERENCES public.drug_master(id),
  dispense_status text,
  dispensed_at timestamptz,
  dispensed_by uuid,
  status public.charge_status NOT NULL DEFAULT 'ordered',
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prescription_item_order ON public.prescription_item(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescription_item TO authenticated;
GRANT ALL ON public.prescription_item TO service_role;
ALTER TABLE public.prescription_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescription_item tenant rw" ON public.prescription_item FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ===== charge_item =====
CREATE TABLE public.charge_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  order_item_table text NOT NULL,
  order_item_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('service','drug')),
  service_id uuid REFERENCES public.service_master(id),
  drug_id uuid REFERENCES public.drug_master(id),
  sbs_code text, achi_code text, loinc_code text,
  gtin text, mrid text,
  internal_code text NOT NULL,
  service_type text,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  quantity_code text,
  unit_price_minor integer,
  factor numeric NOT NULL DEFAULT 1,
  discount_minor integer NOT NULL DEFAULT 0,
  tax_minor integer NOT NULL DEFAULT 0,
  patient_share_minor integer NOT NULL DEFAULT 0,
  payer_share_minor integer NOT NULL DEFAULT 0,
  net_minor integer,
  currency text NOT NULL DEFAULT 'SAR',
  price_list_id uuid REFERENCES public.price_list(id),
  pricing_mode public.charge_pricing_mode NOT NULL,
  in_network boolean,
  cost_only boolean NOT NULL DEFAULT false,
  rule_trace jsonb,
  status public.charge_status NOT NULL DEFAULT 'ordered',
  body_site text,
  ordered_by uuid,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_charge_item_enc ON public.charge_item(encounter_id);
CREATE INDEX idx_charge_item_order ON public.charge_item(order_item_table, order_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charge_item TO authenticated;
GRANT ALL ON public.charge_item TO service_role;
ALTER TABLE public.charge_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "charge_item tenant rw" ON public.charge_item FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ===== pricing_rule =====
CREATE TABLE public.pricing_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  scope public.pricing_rule_scope NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pricing_rule_scope ON public.pricing_rule(scope, priority);
GRANT SELECT ON public.pricing_rule TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pricing_rule TO authenticated;
GRANT ALL ON public.pricing_rule TO service_role;
ALTER TABLE public.pricing_rule ENABLE ROW LEVEL SECURITY;
-- Reads: own tenant rows + global defaults (tenant_id IS NULL)
CREATE POLICY "pricing_rule read" ON public.pricing_rule FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.is_tenant_member(auth.uid(), tenant_id));
-- Writes: only tenant-owned rows; globals are service_role only
CREATE POLICY "pricing_rule write own" ON public.pricing_rule FOR INSERT TO authenticated
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "pricing_rule update own" ON public.pricing_rule FOR UPDATE TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "pricing_rule delete own" ON public.pricing_rule FOR DELETE TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id));

-- ===== Seed system-default rules =====
INSERT INTO public.pricing_rule (tenant_id, name, scope, priority, condition, action, active) VALUES
  (NULL, 'default_cash_full_patient', 'share', 1000, '{"pricing_mode":"cash"}'::jsonb,
    '{"patient_percent":100}'::jsonb, true),
  (NULL, 'default_non_covered_full_patient', 'eligibility', 900, '{"covered":false}'::jsonb,
    '{"patient_percent":100,"preauth_required":true}'::jsonb, true),
  (NULL, 'default_insured_plan_copay', 'share', 500, '{"pricing_mode":"insured"}'::jsonb,
    '{"use_plan_copay":true}'::jsonb, true),
  (NULL, 'default_out_of_network_elevated', 'out_of_network', 700, '{"in_network":false}'::jsonb,
    '{"patient_percent":50}'::jsonb, true);

-- ===== updated_at triggers =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lab_order','lab_order_item','radiology_order','radiology_order_item',
    'electrophysiology_order','ep_order_item','service_order','service_order_item',
    'prescription','prescription_item','charge_item','pricing_rule'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER tg_%I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();',
      t, t);
  END LOOP;
END $$;

-- ===== journey-state trigger =====
CREATE OR REPLACE FUNCTION public.encounter_advance_orders()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.encounter
     SET journey_state = 'investigations_ordered'
   WHERE id = NEW.encounter_id
     AND journey_state IN ('encounter_open','clinically_documented');
  RETURN NEW;
END $$;

CREATE TRIGGER tg_lab_order_advance AFTER INSERT ON public.lab_order
  FOR EACH ROW EXECUTE FUNCTION public.encounter_advance_orders();
CREATE TRIGGER tg_radiology_order_advance AFTER INSERT ON public.radiology_order
  FOR EACH ROW EXECUTE FUNCTION public.encounter_advance_orders();
CREATE TRIGGER tg_ep_order_advance AFTER INSERT ON public.electrophysiology_order
  FOR EACH ROW EXECUTE FUNCTION public.encounter_advance_orders();
CREATE TRIGGER tg_service_order_advance AFTER INSERT ON public.service_order
  FOR EACH ROW EXECUTE FUNCTION public.encounter_advance_orders();
CREATE TRIGGER tg_prescription_advance AFTER INSERT ON public.prescription
  FOR EACH ROW EXECUTE FUNCTION public.encounter_advance_orders();
