
-- =====================================================================
-- Phase 3 Addendum v2 — Price List Builder
-- =====================================================================

-- 1. price_list: multi-level scope, provenance, cost-basis flag
ALTER TABLE public.price_list
  ADD COLUMN IF NOT EXISTS scope_level text NOT NULL DEFAULT 'cash'
    CHECK (scope_level IN ('cash','payer','tpa','policy','class','network')),
  ADD COLUMN IF NOT EXISTS tpa_id uuid REFERENCES public.tpa(id),
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.policy(id),
  ADD COLUMN IF NOT EXISTS insurance_class_id uuid REFERENCES public.insurance_class(id),
  ADD COLUMN IF NOT EXISTS parent_price_list_id uuid REFERENCES public.price_list(id),
  ADD COLUMN IF NOT EXISTS derive_factor numeric,
  ADD COLUMN IF NOT EXISTS is_cost_basis boolean NOT NULL DEFAULT false;

-- Backfill scope_level + is_cost_basis from legacy list_type
UPDATE public.price_list SET
  is_cost_basis = (list_type = 'cost'),
  scope_level = CASE
    WHEN list_type = 'cost' THEN 'cash'
    WHEN list_type = 'cash' THEN 'cash'
    WHEN list_type = 'payer_network' AND network_id IS NOT NULL THEN 'network'
    WHEN list_type = 'payer_network' AND payer_id IS NOT NULL THEN 'payer'
    ELSE 'cash'
  END
WHERE scope_level = 'cash' AND list_type IS NOT NULL;

-- Scope FK consistency: exactly the FK matching scope_level is set; cash = none
ALTER TABLE public.price_list DROP CONSTRAINT IF EXISTS price_list_scope_fk_chk;
ALTER TABLE public.price_list ADD CONSTRAINT price_list_scope_fk_chk CHECK (
  (scope_level = 'cash'    AND payer_id IS NULL AND tpa_id IS NULL AND policy_id IS NULL AND insurance_class_id IS NULL AND network_id IS NULL)
  OR (scope_level = 'payer'   AND payer_id IS NOT NULL AND tpa_id IS NULL AND policy_id IS NULL AND insurance_class_id IS NULL AND network_id IS NULL)
  OR (scope_level = 'tpa'     AND tpa_id   IS NOT NULL AND payer_id IS NULL AND policy_id IS NULL AND insurance_class_id IS NULL AND network_id IS NULL)
  OR (scope_level = 'policy'  AND policy_id IS NOT NULL AND payer_id IS NULL AND tpa_id IS NULL AND insurance_class_id IS NULL AND network_id IS NULL)
  OR (scope_level = 'class'   AND insurance_class_id IS NOT NULL AND payer_id IS NULL AND tpa_id IS NULL AND policy_id IS NULL AND network_id IS NULL)
  OR (scope_level = 'network' AND network_id IS NOT NULL AND payer_id IS NULL AND tpa_id IS NULL AND policy_id IS NULL AND insurance_class_id IS NULL)
);

CREATE INDEX IF NOT EXISTS price_list_scope_idx ON public.price_list (tenant_id, scope_level, active);
CREATE INDEX IF NOT EXISTS price_list_parent_idx ON public.price_list (parent_price_list_id);

-- 2. price_list_item: time band + referral status variants
ALTER TABLE public.price_list_item
  ADD COLUMN IF NOT EXISTS time_band text CHECK (time_band IN ('am','pm')),
  ADD COLUMN IF NOT EXISTS referral_status text CHECK (referral_status IN ('referral','non_referral'));

-- 3. price_list_item_version: price-change log + future-dated prices
CREATE TABLE IF NOT EXISTS public.price_list_item_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  price_list_item_id uuid NOT NULL REFERENCES public.price_list_item(id) ON DELETE CASCADE,
  unit_price_minor integer NOT NULL,
  default_factor numeric NOT NULL DEFAULT 1,
  tax_percent numeric,
  patient_share_percent numeric,
  effective_from date NOT NULL,
  effective_to date,
  change_reason text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_list_item_version TO authenticated;
GRANT ALL ON public.price_list_item_version TO service_role;

ALTER TABLE public.price_list_item_version ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read versions"
  ON public.price_list_item_version FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant members write versions"
  ON public.price_list_item_version FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant members update versions"
  ON public.price_list_item_version FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant members delete versions"
  ON public.price_list_item_version FOR DELETE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE INDEX IF NOT EXISTS price_list_item_version_item_idx
  ON public.price_list_item_version (price_list_item_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS price_list_item_version_tenant_idx
  ON public.price_list_item_version (tenant_id, effective_from);

CREATE TRIGGER price_list_item_version_touch
  BEFORE UPDATE ON public.price_list_item_version
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. service_code: payer-wise NPHIES mapping
ALTER TABLE public.service_code
  ADD COLUMN IF NOT EXISTS payer_id uuid REFERENCES public.payer(id);

-- Drop any prior partial-unique on (service_id) WHERE is_primary_billing,
-- recreate keyed on (service_id, payer_id).
DROP INDEX IF EXISTS public.service_code_primary_billing_uq;
DROP INDEX IF EXISTS public.service_code_service_primary_billing_idx;
CREATE UNIQUE INDEX IF NOT EXISTS service_code_primary_billing_uq
  ON public.service_code (service_id, payer_id)
  WHERE is_primary_billing;

CREATE INDEX IF NOT EXISTS service_code_payer_idx
  ON public.service_code (service_id, payer_id);
