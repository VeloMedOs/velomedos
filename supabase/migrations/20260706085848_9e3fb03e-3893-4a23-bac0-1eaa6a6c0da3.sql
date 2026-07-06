-- M08: PBM formulary + drug_indication_map + R-PBM pricing_rule seeds.

-- ============ chi_formulary ============
CREATE TABLE public.chi_formulary (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  scientific_code_root text NOT NULL,
  scientific_name text NOT NULL,
  atc_code text NULL,
  pharmaceutical_form text NULL,
  pharmaceutical_form_code_root text NULL,
  indication_icd10am text[] NOT NULL DEFAULT '{}',
  coverage_notes text NULL,
  prescribing_edits text NULL,
  otc_flag boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  UNIQUE (tenant_id, scientific_code_root)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chi_formulary TO authenticated;
GRANT ALL ON public.chi_formulary TO service_role;
ALTER TABLE public.chi_formulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read chi_formulary"
  ON public.chi_formulary FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Tenant admins manage chi_formulary"
  ON public.chi_formulary FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX chi_formulary_atc_idx ON public.chi_formulary(tenant_id, atc_code);
CREATE TRIGGER trg_chi_formulary_updated_at BEFORE UPDATE ON public.chi_formulary
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ chi_formulary_version ============
CREATE TABLE public.chi_formulary_version (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  version_label text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid NULL,
  row_count integer NOT NULL DEFAULT 0,
  notes text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chi_formulary_version TO authenticated;
GRANT ALL ON public.chi_formulary_version TO service_role;
ALTER TABLE public.chi_formulary_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read chi_formulary_version"
  ON public.chi_formulary_version FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Tenant admins manage chi_formulary_version"
  ON public.chi_formulary_version FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

-- ============ drug_indication_map ============
CREATE TABLE public.drug_indication_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  internal_code text,
  generic_name text NOT NULL,
  sfda_sci_code text,
  icd10_code text NOT NULL,
  icd10_description text,
  source text NOT NULL DEFAULT 'phase14_2023',
  active boolean NOT NULL DEFAULT true,
  severity text NOT NULL DEFAULT 'block',
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, generic_name, icd10_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drug_indication_map TO authenticated;
GRANT ALL ON public.drug_indication_map TO service_role;
ALTER TABLE public.drug_indication_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read drug_indication_map"
  ON public.drug_indication_map FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Tenant admins manage drug_indication_map"
  ON public.drug_indication_map FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX dim_tenant_generic_idx ON public.drug_indication_map(tenant_id, generic_name);
CREATE INDEX dim_tenant_icd_idx ON public.drug_indication_map(tenant_id, icd10_code);

CREATE TRIGGER trg_drug_indication_map_updated_at BEFORE UPDATE ON public.drug_indication_map
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();