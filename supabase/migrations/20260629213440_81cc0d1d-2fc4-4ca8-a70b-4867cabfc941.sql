
-- =============================================================================
-- RCM Phase R1 — Contract enrichment + Eligibility / Activation lifecycle
-- =============================================================================
-- Standing rules: tenant-scoped, RLS, money in halalas (*_minor), full GRANTs.
-- Note: clinical_role enum values (front_office, rcm, approval_officer) already
-- exist from the HIS access-entry expand; not added here.
-- =============================================================================

-- ---------- A. Contract enrichment (extend existing Phase 3 masters) ----------

-- payer: CCHI number
ALTER TABLE public.payer
  ADD COLUMN IF NOT EXISTS cchi_number text;

-- policy: expiry date, internal serial
ALTER TABLE public.policy
  ADD COLUMN IF NOT EXISTS policy_date_expiry date,
  ADD COLUMN IF NOT EXISTS internal_serial_number text;

-- insurance_class: deductible / limits / approval_limit / room_type / direct
-- network reference (precedence: class overrides network in the resolver).
ALTER TABLE public.insurance_class
  ADD COLUMN IF NOT EXISTS deductible jsonb,
  ADD COLUMN IF NOT EXISTS maximum_limit_minor bigint,
  ADD COLUMN IF NOT EXISTS approval_limit_minor bigint,
  ADD COLUMN IF NOT EXISTS room_type text,
  ADD COLUMN IF NOT EXISTS network_id uuid REFERENCES public.network(id) ON DELETE SET NULL;

-- network: deductible / limits / approval_limit / room_type
ALTER TABLE public.network
  ADD COLUMN IF NOT EXISTS deductible jsonb,
  ADD COLUMN IF NOT EXISTS maximum_limit_minor bigint,
  ADD COLUMN IF NOT EXISTS approval_limit_minor bigint,
  ADD COLUMN IF NOT EXISTS room_type text;

-- ---------- B. Contract-layer new tables ----------

CREATE TABLE IF NOT EXISTS public.payer_agreement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.payer(id) ON DELETE CASCADE,
  tpa_id uuid REFERENCES public.tpa(id) ON DELETE SET NULL,
  agreement_no text NOT NULL,
  contract_start date NOT NULL,
  contract_end date,
  settlement_terms_days int NOT NULL DEFAULT 30,
  prompt_payment_discount_percent numeric,
  volume_discount_rules jsonb,
  vat_treatment text NOT NULL DEFAULT 'standard',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payer_id, agreement_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payer_agreement TO authenticated;
GRANT ALL ON public.payer_agreement TO service_role;
ALTER TABLE public.payer_agreement ENABLE ROW LEVEL SECURITY;
CREATE POLICY payer_agreement_tenant_rw ON public.payer_agreement
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY payer_agreement_service ON public.payer_agreement
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER payer_agreement_touch BEFORE UPDATE ON public.payer_agreement
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.not_covered_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid REFERENCES public.payer(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.policy(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.insurance_class(id) ON DELETE CASCADE,
  scope text NOT NULL,  -- specialty|clinical_condition|icd10|approval_limit|payer|class_exclusion
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.not_covered_rule TO authenticated;
GRANT ALL ON public.not_covered_rule TO service_role;
ALTER TABLE public.not_covered_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY ncr_tenant_rw ON public.not_covered_rule FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY ncr_service ON public.not_covered_rule FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER ncr_touch BEFORE UPDATE ON public.not_covered_rule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.need_approval_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid REFERENCES public.payer(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.policy(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.insurance_class(id) ON DELETE CASCADE,
  scope text NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.need_approval_rule TO authenticated;
GRANT ALL ON public.need_approval_rule TO service_role;
ALTER TABLE public.need_approval_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY nar_tenant_rw ON public.need_approval_rule FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY nar_service ON public.need_approval_rule FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER nar_touch BEFORE UPDATE ON public.need_approval_rule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.maternity_protocol (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid REFERENCES public.payer(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.policy(id) ON DELETE CASCADE,
  name text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maternity_protocol TO authenticated;
GRANT ALL ON public.maternity_protocol TO service_role;
ALTER TABLE public.maternity_protocol ENABLE ROW LEVEL SECURITY;
CREATE POLICY mp_tenant_rw ON public.maternity_protocol FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY mp_service ON public.maternity_protocol FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER mp_touch BEFORE UPDATE ON public.maternity_protocol
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Governed audit-controlled tariff/policy/class/network change-request worklist.
CREATE TABLE IF NOT EXISTS public.contract_change_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  before jsonb,
  after jsonb NOT NULL,
  effective_date date,
  status text NOT NULL DEFAULT 'draft', -- draft|approved|applied|rejected
  reason text,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  applied_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_change_request TO authenticated;
GRANT ALL ON public.contract_change_request TO service_role;
ALTER TABLE public.contract_change_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccr_tenant_rw ON public.contract_change_request FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY ccr_service ON public.contract_change_request FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER ccr_touch BEFORE UPDATE ON public.contract_change_request
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS ccr_tenant_status_idx ON public.contract_change_request(tenant_id, status);

-- ---------- C. Eligibility lifecycle ----------

CREATE TABLE IF NOT EXISTS public.visit_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid REFERENCES public.encounter(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new',
    -- new|checking|eligible|not_eligible|error|exception_review|exception_approved
    -- |activation_pending|activated|insured|self_pay|cancelled
  financial_type text NOT NULL DEFAULT 'pending', -- insurance|self_pay|pending
  eligibility_type text NOT NULL DEFAULT 'standard', -- standard|referral|emergency|newborn
  eligibility_ref_no text,
  membership_id text,
  payer_id uuid REFERENCES public.payer(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.policy(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.insurance_class(id) ON DELETE SET NULL,
  network_id uuid REFERENCES public.network(id) ON DELETE SET NULL,
  reason text,
  override_reason text,
  result_payload jsonb,
  checked_at timestamptz,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_eligibility TO authenticated;
GRANT ALL ON public.visit_eligibility TO service_role;
ALTER TABLE public.visit_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY ve_tenant_rw ON public.visit_eligibility FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY ve_service ON public.visit_eligibility FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER ve_touch BEFORE UPDATE ON public.visit_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- One active eligibility per encounter.
CREATE UNIQUE INDEX IF NOT EXISTS visit_eligibility_one_active
  ON public.visit_eligibility(encounter_id)
  WHERE status <> 'cancelled' AND encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS visit_eligibility_tenant_status_idx
  ON public.visit_eligibility(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.eligibility_exception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  visit_eligibility_id uuid NOT NULL REFERENCES public.visit_eligibility(id) ON DELETE CASCADE,
  exception_type text NOT NULL, -- referral|emergency|newborn
  referral_letter_url text,
  referral_ref_no text,
  referred_provider text,
  referral_date date,
  ctas_level int,
  birth_certificate_url text,
  mother_membership_no text,
  mother_coverage_id uuid REFERENCES public.coverage(id) ON DELETE SET NULL,
  validity_from date,
  validity_to date,
  notes text,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eligibility_exception TO authenticated;
GRANT ALL ON public.eligibility_exception TO service_role;
ALTER TABLE public.eligibility_exception ENABLE ROW LEVEL SECURITY;
CREATE POLICY ee_tenant_rw ON public.eligibility_exception FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY ee_service ON public.eligibility_exception FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER ee_touch BEFORE UPDATE ON public.eligibility_exception
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- Trigger validation: CTAS must be 1 or 2 for emergency exceptions.
CREATE OR REPLACE FUNCTION public.eligibility_exception_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.exception_type = 'emergency' AND (NEW.ctas_level IS NULL OR NEW.ctas_level NOT IN (1,2)) THEN
    RAISE EXCEPTION 'emergency exception requires CTAS level 1 or 2';
  END IF;
  IF NEW.exception_type = 'referral' AND NEW.referral_letter_url IS NULL AND NEW.referral_ref_no IS NULL THEN
    RAISE EXCEPTION 'referral exception requires a referral letter or reference no';
  END IF;
  IF NEW.exception_type = 'newborn' AND NEW.mother_coverage_id IS NULL AND NEW.mother_membership_no IS NULL THEN
    RAISE EXCEPTION 'newborn exception requires mother coverage or membership';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ee_validate ON public.eligibility_exception;
CREATE TRIGGER ee_validate BEFORE INSERT OR UPDATE ON public.eligibility_exception
  FOR EACH ROW EXECUTE FUNCTION public.eligibility_exception_validate();

CREATE TABLE IF NOT EXISTS public.policy_activation_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  visit_eligibility_id uuid NOT NULL REFERENCES public.visit_eligibility(id) ON DELETE CASCADE,
  requested_by uuid,
  status text NOT NULL DEFAULT 'pending', -- pending|in_progress|activated|rejected
  payer_id uuid REFERENCES public.payer(id) ON DELETE SET NULL,
  policy_no text,
  class_code text,
  is_ineligible_flag boolean NOT NULL DEFAULT false,
  membership_no text,
  validity_from date,
  validity_to date,
  assigned_to uuid,
  activated_by uuid,
  activated_at timestamptz,
  notify_reception_at timestamptz,
  notes text,
  created_by uuid, updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_activation_request TO authenticated;
GRANT ALL ON public.policy_activation_request TO service_role;
ALTER TABLE public.policy_activation_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY par_tenant_rw ON public.policy_activation_request FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY par_service ON public.policy_activation_request FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER par_touch BEFORE UPDATE ON public.policy_activation_request
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS par_tenant_status_idx ON public.policy_activation_request(tenant_id, status);
