
-- =====================================================================
-- Phase 3 — Master Data: Insurance Chain, Service Master, Drug Master,
-- Price Lists, AR-DRG Pricing.
-- =====================================================================

-- ---------- 1. INSURANCE CHAIN ----------

-- payer
CREATE TABLE public.payer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  nphies_payer_id text NOT NULL,
  name text NOT NULL,
  payer_type text NOT NULL DEFAULT 'private' CHECK (payer_type IN ('public','private')),
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nphies_payer_id)
);
CREATE INDEX payer_tenant_idx ON public.payer(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payer TO authenticated;
GRANT ALL ON public.payer TO service_role;
ALTER TABLE public.payer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payer tenant read" ON public.payer FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "payer tenant insert" ON public.payer FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "payer tenant update" ON public.payer FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "payer tenant delete" ON public.payer FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER payer_touch BEFORE UPDATE ON public.payer FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- tpa (no payer_id — many-to-many)
CREATE TABLE public.tpa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  nphies_tpa_id text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nphies_tpa_id)
);
CREATE INDEX tpa_tenant_idx ON public.tpa(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tpa TO authenticated;
GRANT ALL ON public.tpa TO service_role;
ALTER TABLE public.tpa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpa tenant read" ON public.tpa FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tpa tenant insert" ON public.tpa FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tpa tenant update" ON public.tpa FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tpa tenant delete" ON public.tpa FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER tpa_touch BEFORE UPDATE ON public.tpa FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- policy
CREATE TABLE public.policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.payer(id) ON DELETE RESTRICT,
  policy_number text NOT NULL,
  name text,
  effective_date date,
  expiry_date date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, policy_number)
);
CREATE INDEX policy_tenant_payer_idx ON public.policy(tenant_id, payer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy TO authenticated;
GRANT ALL ON public.policy TO service_role;
ALTER TABLE public.policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "policy tenant read" ON public.policy FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "policy tenant insert" ON public.policy FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "policy tenant update" ON public.policy FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "policy tenant delete" ON public.policy FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER policy_touch BEFORE UPDATE ON public.policy FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- insurance_class
CREATE TABLE public.insurance_class (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.policy(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, code)
);
CREATE INDEX insurance_class_tenant_idx ON public.insurance_class(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_class TO authenticated;
GRANT ALL ON public.insurance_class TO service_role;
ALTER TABLE public.insurance_class ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_class tenant read" ON public.insurance_class FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "insurance_class tenant insert" ON public.insurance_class FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "insurance_class tenant update" ON public.insurance_class FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "insurance_class tenant delete" ON public.insurance_class FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER insurance_class_touch BEFORE UPDATE ON public.insurance_class FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- insurance_plan
CREATE TABLE public.insurance_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.insurance_class(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text,
  copay_percent numeric,
  deductible_minor integer,
  annual_limit_minor integer,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, code)
);
CREATE INDEX insurance_plan_tenant_idx ON public.insurance_plan(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_plan TO authenticated;
GRANT ALL ON public.insurance_plan TO service_role;
ALTER TABLE public.insurance_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insurance_plan tenant read" ON public.insurance_plan FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "insurance_plan tenant insert" ON public.insurance_plan FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "insurance_plan tenant update" ON public.insurance_plan FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "insurance_plan tenant delete" ON public.insurance_plan FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER insurance_plan_touch BEFORE UPDATE ON public.insurance_plan FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- network
CREATE TABLE public.network (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.payer(id) ON DELETE RESTRICT,
  name text NOT NULL,
  tier text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX network_tenant_payer_idx ON public.network(tenant_id, payer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network TO authenticated;
GRANT ALL ON public.network TO service_role;
ALTER TABLE public.network ENABLE ROW LEVEL SECURITY;
CREATE POLICY "network tenant read" ON public.network FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "network tenant insert" ON public.network FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "network tenant update" ON public.network FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "network tenant delete" ON public.network FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER network_touch BEFORE UPDATE ON public.network FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- network_membership (bound to clinics as the facility entity)
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS nphies_provider_id text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.corporate_accounts(id) ON DELETE SET NULL;

CREATE TABLE public.network_membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  network_id uuid NOT NULL REFERENCES public.network(id) ON DELETE CASCADE,
  provider_facility_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  in_network boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network_id, provider_facility_id)
);
CREATE INDEX network_membership_tenant_idx ON public.network_membership(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.network_membership TO authenticated;
GRANT ALL ON public.network_membership TO service_role;
ALTER TABLE public.network_membership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "network_membership tenant read" ON public.network_membership FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "network_membership tenant insert" ON public.network_membership FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "network_membership tenant update" ON public.network_membership FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "network_membership tenant delete" ON public.network_membership FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER network_membership_touch BEFORE UPDATE ON public.network_membership FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- Backfill Phase-1 coverage FKs + tpa_id ----------
ALTER TABLE public.coverage ADD COLUMN IF NOT EXISTS tpa_id uuid;
ALTER TABLE public.coverage
  ADD CONSTRAINT coverage_payer_fk          FOREIGN KEY (payer_id)          REFERENCES public.payer(id)          ON DELETE SET NULL,
  ADD CONSTRAINT coverage_tpa_fk            FOREIGN KEY (tpa_id)            REFERENCES public.tpa(id)            ON DELETE SET NULL,
  ADD CONSTRAINT coverage_policy_fk         FOREIGN KEY (policy_id)         REFERENCES public.policy(id)         ON DELETE SET NULL,
  ADD CONSTRAINT coverage_insurance_plan_fk FOREIGN KEY (insurance_plan_id) REFERENCES public.insurance_plan(id) ON DELETE SET NULL,
  ADD CONSTRAINT coverage_network_fk        FOREIGN KEY (network_id)        REFERENCES public.network(id)        ON DELETE SET NULL;

-- Bind Phase-2 encounter.location_id placeholder
ALTER TABLE public.encounter
  ADD CONSTRAINT encounter_location_fk FOREIGN KEY (location_id) REFERENCES public.clinics(id) ON DELETE SET NULL;

-- ---------- 2. SERVICE MASTER ----------
CREATE TABLE public.service_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  internal_code text NOT NULL,
  name text NOT NULL,
  description text,
  service_type text NOT NULL CHECK (service_type IN
    ('laboratory','imaging','procedures','services','medical-devices','oral-health-ip','oral-health-op','transportation-srca')),
  modality text,
  is_package boolean NOT NULL DEFAULT false,
  body_site text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, internal_code)
);
CREATE INDEX service_master_tenant_type_idx ON public.service_master(tenant_id, service_type, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_master TO authenticated;
GRANT ALL ON public.service_master TO service_role;
ALTER TABLE public.service_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_master tenant read" ON public.service_master FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "service_master tenant insert" ON public.service_master FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "service_master tenant update" ON public.service_master FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "service_master tenant delete" ON public.service_master FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER service_master_touch BEFORE UPDATE ON public.service_master FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.service_code (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.service_master(id) ON DELETE CASCADE,
  code_system_id uuid NOT NULL REFERENCES public.code_system(id) ON DELETE RESTRICT,
  code text NOT NULL,
  display text,
  is_primary_billing boolean NOT NULL DEFAULT false,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, code_system_id, code)
);
CREATE UNIQUE INDEX service_code_primary_billing_uniq ON public.service_code(service_id) WHERE is_primary_billing;
CREATE INDEX service_code_tenant_idx ON public.service_code(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_code TO authenticated;
GRANT ALL ON public.service_code TO service_role;
ALTER TABLE public.service_code ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_code tenant read" ON public.service_code FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "service_code tenant insert" ON public.service_code FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "service_code tenant update" ON public.service_code FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "service_code tenant delete" ON public.service_code FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER service_code_touch BEFORE UPDATE ON public.service_code FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- 3. DRUG MASTER ----------
CREATE TABLE public.drug_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  internal_code text NOT NULL,
  generic_name text NOT NULL,
  trade_name text,
  form text,
  strength text,
  route text,
  gtin text,
  mrid text,
  sfda_sci_code text,
  atc_code text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, internal_code)
);
CREATE INDEX drug_master_tenant_gtin_idx ON public.drug_master(tenant_id, gtin);
CREATE INDEX drug_master_tenant_mrid_idx ON public.drug_master(tenant_id, mrid);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drug_master TO authenticated;
GRANT ALL ON public.drug_master TO service_role;
ALTER TABLE public.drug_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drug_master tenant read" ON public.drug_master FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drug_master tenant insert" ON public.drug_master FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drug_master tenant update" ON public.drug_master FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drug_master tenant delete" ON public.drug_master FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER drug_master_touch BEFORE UPDATE ON public.drug_master FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- 4. PRICE LISTS ----------
CREATE TABLE public.price_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  list_type text NOT NULL CHECK (list_type IN ('cash','payer_network')),
  payer_id uuid REFERENCES public.payer(id) ON DELETE SET NULL,
  network_id uuid REFERENCES public.network(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'SAR',
  effective_date date,
  expiry_date date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (list_type = 'cash' OR payer_id IS NOT NULL)
);
CREATE INDEX price_list_tenant_idx ON public.price_list(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list TO authenticated;
GRANT ALL ON public.price_list TO service_role;
ALTER TABLE public.price_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_list tenant read" ON public.price_list FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "price_list tenant insert" ON public.price_list FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "price_list tenant update" ON public.price_list FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "price_list tenant delete" ON public.price_list FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER price_list_touch BEFORE UPDATE ON public.price_list FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.price_list_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  price_list_id uuid NOT NULL REFERENCES public.price_list(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.service_master(id) ON DELETE CASCADE,
  drug_id uuid REFERENCES public.drug_master(id) ON DELETE CASCADE,
  unit_price_minor integer NOT NULL CHECK (unit_price_minor >= 0),
  default_factor numeric NOT NULL DEFAULT 1,
  patient_share_percent numeric,
  tax_percent numeric,
  is_package boolean NOT NULL DEFAULT false,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((service_id IS NOT NULL) <> (drug_id IS NOT NULL))
);
CREATE INDEX price_list_item_pl_idx       ON public.price_list_item(price_list_id);
CREATE INDEX price_list_item_tenant_svc_idx ON public.price_list_item(tenant_id, service_id);
CREATE INDEX price_list_item_tenant_drug_idx ON public.price_list_item(tenant_id, drug_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_item TO authenticated;
GRANT ALL ON public.price_list_item TO service_role;
ALTER TABLE public.price_list_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_list_item tenant read" ON public.price_list_item FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "price_list_item tenant insert" ON public.price_list_item FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "price_list_item tenant update" ON public.price_list_item FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "price_list_item tenant delete" ON public.price_list_item FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER price_list_item_touch BEFORE UPDATE ON public.price_list_item FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- 5. AR-DRG PRICING ----------

-- drg (tenant-agnostic reference; SELECT only via RLS, writes via service_role / platform loader)
CREATE TABLE public.drg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_system_id uuid NOT NULL REFERENCES public.code_system(id) ON DELETE RESTRICT,
  drg_code text NOT NULL,
  drg_name text,
  mdc text,
  adrg text,
  partition text CHECK (partition IN ('medical','intervention')),
  version text NOT NULL,
  relative_weight numeric NOT NULL,
  low_trim_los integer,
  high_trim_los integer,
  avg_los numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drg_code, version)
);
CREATE INDEX drg_version_active_idx ON public.drg(version, active);
GRANT SELECT ON public.drg TO authenticated;
GRANT ALL ON public.drg TO service_role;
ALTER TABLE public.drg ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drg read for authenticated" ON public.drg FOR SELECT TO authenticated USING (true);
-- No INSERT/UPDATE/DELETE policy: writes only via service_role.
CREATE TRIGGER drg_touch BEFORE UPDATE ON public.drg FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.drg_base_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.payer(id) ON DELETE RESTRICT,
  network_id uuid REFERENCES public.network(id) ON DELETE SET NULL,
  drg_version text NOT NULL,
  base_rate_minor integer NOT NULL CHECK (base_rate_minor >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  effective_from date,
  effective_to date,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX drg_base_rate_lookup_idx ON public.drg_base_rate(tenant_id, payer_id, drg_version, effective_from DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drg_base_rate TO authenticated;
GRANT ALL ON public.drg_base_rate TO service_role;
ALTER TABLE public.drg_base_rate ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drg_base_rate tenant read" ON public.drg_base_rate FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_base_rate tenant insert" ON public.drg_base_rate FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_base_rate tenant update" ON public.drg_base_rate FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_base_rate tenant delete" ON public.drg_base_rate FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER drg_base_rate_touch BEFORE UPDATE ON public.drg_base_rate FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.drg_price_adjustment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid REFERENCES public.payer(id) ON DELETE SET NULL,
  drg_version text,
  adj_type text NOT NULL CHECK (adj_type IN ('high_outlier','low_outlier','short_stay','icu_addon','sameday','transfer')),
  trim_basis text CHECK (trim_basis IN ('los','cost')),
  per_diem_minor integer,
  marginal_rate numeric,
  threshold numeric,
  formula jsonb,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX drg_price_adjustment_tenant_idx ON public.drg_price_adjustment(tenant_id, payer_id, drg_version);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drg_price_adjustment TO authenticated;
GRANT ALL ON public.drg_price_adjustment TO service_role;
ALTER TABLE public.drg_price_adjustment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drg_price_adjustment tenant read" ON public.drg_price_adjustment FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_price_adjustment tenant insert" ON public.drg_price_adjustment FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_price_adjustment tenant update" ON public.drg_price_adjustment FOR UPDATE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_price_adjustment tenant delete" ON public.drg_price_adjustment FOR DELETE TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER drg_price_adjustment_touch BEFORE UPDATE ON public.drg_price_adjustment FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
