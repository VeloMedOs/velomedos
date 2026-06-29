
-- Phase 7 — Claim assembly + FHIR bundle
-- =====================================================================

-- 1. Add 'biller' to clinical_role enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname='clinical_role' AND e.enumlabel='biller') THEN
    ALTER TYPE public.clinical_role ADD VALUE 'biller';
  END IF;
END $$;

-- 2. claim header -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE RESTRICT,
  coverage_id uuid REFERENCES public.coverage(id),
  drg_assignment_id uuid REFERENCES public.drg_assignment(id),
  replaces_claim_id uuid REFERENCES public.claim(id),
  provider_claim_no text NOT NULL,
  invoice_no text,
  claim_type text NOT NULL,                 -- professional|institutional|pharmacy|oral|vision
  claim_subtype text NOT NULL,              -- op|ip|emergency
  billing_model text NOT NULL CHECK (billing_model IN ('itemized_sbs','drg_bundled')),
  total_net_minor integer NOT NULL DEFAULT 0,
  total_patient_share_minor integer NOT NULL DEFAULT 0,
  total_payer_share_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','submitted','accepted','rejected')),
  nphies_response jsonb,
  submitted_at timestamptz,
  pricing_trace jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider_claim_no)
);
CREATE INDEX IF NOT EXISTS claim_tenant_enc_idx ON public.claim(tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS claim_status_idx ON public.claim(tenant_id, status);
-- One active claim per encounter (rejected/replaced allow a new one)
CREATE UNIQUE INDEX IF NOT EXISTS claim_one_active_per_encounter
  ON public.claim(encounter_id) WHERE status IN ('draft','ready','submitted','accepted');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim TO authenticated;
GRANT ALL ON public.claim TO service_role;
ALTER TABLE public.claim ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim tenant select" ON public.claim FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "claim tenant write" ON public.claim FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "claim service" ON public.claim FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER claim_touch BEFORE UPDATE ON public.claim
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. claim_item -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  charge_item_id uuid REFERENCES public.charge_item(id),
  service_type text,
  service_code text,
  non_standard_code text,
  description text,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_minor integer NOT NULL DEFAULT 0,
  factor numeric NOT NULL DEFAULT 1,
  discount_minor integer NOT NULL DEFAULT 0,
  tax_minor integer NOT NULL DEFAULT 0,
  patient_share_minor integer NOT NULL DEFAULT 0,
  payer_share_minor integer NOT NULL DEFAULT 0,
  net_minor integer NOT NULL DEFAULT 0,
  is_package boolean NOT NULL DEFAULT false,
  body_site text,
  sub_site text,
  cost_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, sequence_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_item TO authenticated;
GRANT ALL ON public.claim_item TO service_role;
ALTER TABLE public.claim_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_item tenant select" ON public.claim_item FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "claim_item tenant write" ON public.claim_item FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "claim_item service" ON public.claim_item FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. claim_diagnosis --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_diagnosis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  code text NOT NULL,
  code_system text,
  display text,
  role text,
  present_on_admission text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, sequence_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_diagnosis TO authenticated;
GRANT ALL ON public.claim_diagnosis TO service_role;
ALTER TABLE public.claim_diagnosis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cdx select" ON public.claim_diagnosis FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cdx write" ON public.claim_diagnosis FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cdx service" ON public.claim_diagnosis FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. claim_care_team --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_care_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  practitioner_user_id uuid,
  role text,
  speciality text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, sequence_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_care_team TO authenticated;
GRANT ALL ON public.claim_care_team TO service_role;
ALTER TABLE public.claim_care_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cct select" ON public.claim_care_team FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cct write" ON public.claim_care_team FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cct service" ON public.claim_care_team FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. claim_supporting_info -------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_supporting_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  category text NOT NULL,
  code text,
  code_system text,
  value text,
  unit text,
  timing timestamptz,
  source_table text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, sequence_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_supporting_info TO authenticated;
GRANT ALL ON public.claim_supporting_info TO service_role;
ALTER TABLE public.claim_supporting_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csi2 select" ON public.claim_supporting_info FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "csi2 write" ON public.claim_supporting_info FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "csi2 service" ON public.claim_supporting_info FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. claim_item_link --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_item_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  item_sequence_no integer NOT NULL,
  link_type text NOT NULL CHECK (link_type IN ('diagnosis','care_team','supporting_info')),
  target_sequence_no integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, item_sequence_no, link_type, target_sequence_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_item_link TO authenticated;
GRANT ALL ON public.claim_item_link TO service_role;
ALTER TABLE public.claim_item_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cil select" ON public.claim_item_link FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cil write" ON public.claim_item_link FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cil service" ON public.claim_item_link FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Journey advance trigger -----------------------------------------
CREATE OR REPLACE FUNCTION public.claim_advance_journey() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('ready','accepted') THEN
    PERFORM public.encounter_advance_journey(NEW.encounter_id, 'claim_ready');
  END IF;
  IF NEW.status = 'submitted' THEN
    PERFORM public.encounter_advance_journey(NEW.encounter_id, 'submitted');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_claim_journey ON public.claim;
CREATE TRIGGER trg_claim_journey
AFTER INSERT OR UPDATE OF status ON public.claim
FOR EACH ROW EXECUTE FUNCTION public.claim_advance_journey();
