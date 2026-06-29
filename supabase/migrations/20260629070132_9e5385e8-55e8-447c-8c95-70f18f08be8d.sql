
-- ============================================================================
-- Phase 1 — Registration MDS (Beneficiary + Coverage + CoverageClass)
-- ============================================================================

-- Helper: is the user a member of this tenant?
CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id AND tenant_id = _tenant
  );
$$;

-- ----------------------------------------------------------------------------
-- beneficiary
-- ----------------------------------------------------------------------------
CREATE TABLE public.beneficiary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  patient_file_no text,
  first_name text,
  middle_name text,
  last_name text,
  full_name text NOT NULL,
  dob date NOT NULL,
  gender text NOT NULL,
  nationality text,
  document_type text NOT NULL,
  document_id text NOT NULL,
  contact_number text,
  ehealth_id text,
  residency_type text,
  marital_status text,
  blood_group text,
  preferred_language text,
  email text,
  address_line text,
  address_street text,
  address_city text,
  address_district text,
  address_state text,
  address_postal_code text,
  address_country text,
  occupation text,
  religion text,
  birth_weight_grams int,
  patient_user_id uuid,
  journey_state text NOT NULL DEFAULT 'registered',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_type, document_id)
);
CREATE INDEX beneficiary_tenant_name_idx ON public.beneficiary (tenant_id, full_name);
CREATE INDEX beneficiary_tenant_file_idx ON public.beneficiary (tenant_id, patient_file_no);
CREATE INDEX beneficiary_user_idx ON public.beneficiary (patient_user_id) WHERE patient_user_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiary TO authenticated;
GRANT ALL ON public.beneficiary TO service_role;
ALTER TABLE public.beneficiary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beneficiary tenant members read"
  ON public.beneficiary FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "beneficiary tenant members write"
  ON public.beneficiary FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "beneficiary tenant members update"
  ON public.beneficiary FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "beneficiary tenant members delete"
  ON public.beneficiary FOR DELETE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER beneficiary_touch_updated_at
  BEFORE UPDATE ON public.beneficiary
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- coverage
-- ----------------------------------------------------------------------------
CREATE TABLE public.coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  coverage_type text NOT NULL,
  member_id text NOT NULL,
  policy_number text,
  expiry_date date,
  payer_nphies_id text NOT NULL,
  tpa_nphies_id text,
  relation_with_subscriber text NOT NULL,
  policy_holder text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  -- Phase-3 master placeholders (no FK target yet; bound when masters land)
  payer_id uuid,
  policy_id uuid,
  insurance_plan_id uuid,
  network_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coverage_beneficiary_idx ON public.coverage (beneficiary_id);
CREATE INDEX coverage_tenant_idx ON public.coverage (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage TO authenticated;
GRANT ALL ON public.coverage TO service_role;
ALTER TABLE public.coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coverage tenant members read"
  ON public.coverage FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coverage tenant members insert"
  ON public.coverage FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coverage tenant members update"
  ON public.coverage FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coverage tenant members delete"
  ON public.coverage FOR DELETE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER coverage_touch_updated_at
  BEFORE UPDATE ON public.coverage
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- coverage_class
-- ----------------------------------------------------------------------------
CREATE TABLE public.coverage_class (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  coverage_id uuid NOT NULL REFERENCES public.coverage(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('group','plan')),
  value text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coverage_class_coverage_idx ON public.coverage_class (coverage_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage_class TO authenticated;
GRANT ALL ON public.coverage_class TO service_role;
ALTER TABLE public.coverage_class ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coverage_class tenant members read"
  ON public.coverage_class FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coverage_class tenant members insert"
  ON public.coverage_class FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coverage_class tenant members update"
  ON public.coverage_class FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coverage_class tenant members delete"
  ON public.coverage_class FOR DELETE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER coverage_class_touch_updated_at
  BEFORE UPDATE ON public.coverage_class
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
