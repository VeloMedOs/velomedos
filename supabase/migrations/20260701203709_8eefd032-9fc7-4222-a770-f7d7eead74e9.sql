
-- ============ Enums (all new — safe same-txn) ============
CREATE TYPE public.admission_status AS ENUM
  ('requested','authorized','lounge','admitted','discharged','cancelled');

CREATE TYPE public.ip_request_type AS ENUM
  ('surgery','procedure','cath','medical','day_case');

CREATE TYPE public.auth_scope AS ENUM
  ('package','blood','room_board','transfer','los_extension','order','prescription');

CREATE TYPE public.bed_transfer_status AS ENUM
  ('requested','preauth_pending','approved','rejected','executed','cancelled');

CREATE TYPE public.los_ext_status AS ENUM
  ('requested','approved','rejected','extended','cancelled');

CREATE TYPE public.deposit_status AS ENUM
  ('requested','collected','applied','refunded','cancelled');

CREATE TYPE public.deposit_method AS ENUM
  ('cash','card','bank_transfer','wallet','insurance');

CREATE TYPE public.discharge_stage AS ENUM
  ('none','discharge_advice','discharge_order','medical_discharge','financial_discharge');

-- ============ ip_package (master) ============
CREATE TABLE public.ip_package (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  package_code TEXT NOT NULL,
  name TEXT NOT NULL,
  package_type TEXT NOT NULL DEFAULT 'hospital_stay' CHECK (package_type IN ('day_case','hospital_stay')),
  duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days >= 0),
  room_type TEXT,
  price_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  UNIQUE (tenant_id, package_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_package TO authenticated;
GRANT ALL ON public.ip_package TO service_role;
ALTER TABLE public.ip_package ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ip_package tenant read"  ON public.ip_package FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "ip_package tenant write" ON public.ip_package FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER ip_package_touch BEFORE UPDATE ON public.ip_package
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ room_board_entitlement ============
CREATE TABLE public.room_board_entitlement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  class_id UUID NOT NULL REFERENCES public.insurance_class(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1, -- higher = more critical (ICU, HDU); transfers upward trigger preauth
  daily_rate_minor BIGINT NOT NULL DEFAULT 0,
  covered BOOLEAN NOT NULL DEFAULT true,
  upgrade_allowed BOOLEAN NOT NULL DEFAULT false,
  currency TEXT NOT NULL DEFAULT 'SAR',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  UNIQUE (tenant_id, class_id, room_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_board_entitlement TO authenticated;
GRANT ALL ON public.room_board_entitlement TO service_role;
ALTER TABLE public.room_board_entitlement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rbe tenant read"  ON public.room_board_entitlement FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "rbe tenant write" ON public.room_board_entitlement FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER rbe_touch BEFORE UPDATE ON public.room_board_entitlement
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ admission_request ============
CREATE TABLE public.admission_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  encounter_id UUID NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  beneficiary_id UUID REFERENCES public.beneficiary(id),
  admission_no TEXT,           -- generated on reception save
  admission_serial TEXT,        -- generated on reception save
  request_type public.ip_request_type NOT NULL DEFAULT 'medical',
  mrp_id UUID,                  -- most-responsible physician
  consent_id UUID,
  payer_id UUID REFERENCES public.payer(id),
  policy_id UUID REFERENCES public.policy(id),
  class_id UUID REFERENCES public.insurance_class(id),
  network_id UUID REFERENCES public.network(id),
  coverage_id UUID REFERENCES public.coverage(id),
  eligibility_ref UUID REFERENCES public.visit_eligibility(id),
  package_id UUID REFERENCES public.ip_package(id),
  package_duration_days INTEGER,
  los_days INTEGER,
  edd DATE,                     -- estimated discharge date
  room_type_entitled TEXT,
  admission_source TEXT,
  status public.admission_status NOT NULL DEFAULT 'requested',
  journey_state TEXT NOT NULL DEFAULT 'requested',
  discharge_stage public.discharge_stage NOT NULL DEFAULT 'none',
  requested_deposit_minor BIGINT NOT NULL DEFAULT 0,
  paid_amount_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  -- lounge gates
  consent_captured_at TIMESTAMPTZ,
  bed_reserved_at TIMESTAMPTZ,
  pac_completed_at TIMESTAMPTZ,
  anesthesia_fit BOOLEAN,
  anesthesia_fit_at TIMESTAMPTZ,
  -- admission / discharge marks
  admitted_at TIMESTAMPTZ,
  discharged_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  reasons_triggered JSONB NOT NULL DEFAULT '[]'::jsonb,
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
CREATE INDEX ip_admission_tenant_status_idx ON public.admission_request(tenant_id, status);
CREATE INDEX ip_admission_enc_idx ON public.admission_request(encounter_id);
CREATE INDEX ip_admission_stage_idx ON public.admission_request(tenant_id, discharge_stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admission_request TO authenticated;
GRANT ALL ON public.admission_request TO service_role;
ALTER TABLE public.admission_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adm_req tenant read"  ON public.admission_request FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "adm_req tenant write" ON public.admission_request FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER adm_req_touch BEFORE UPDATE ON public.admission_request
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Derive LOS/EDD from package on insert/update when package_id changes.
CREATE OR REPLACE FUNCTION public.admission_request_derive_los()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _dur INTEGER; _rt TEXT;
BEGIN
  IF NEW.package_id IS NOT NULL AND
     (TG_OP = 'INSERT' OR NEW.package_id IS DISTINCT FROM OLD.package_id) THEN
    SELECT duration_days, room_type INTO _dur, _rt
      FROM public.ip_package WHERE id = NEW.package_id;
    IF _dur IS NOT NULL THEN
      NEW.package_duration_days := _dur;
      IF NEW.los_days IS NULL THEN NEW.los_days := _dur; END IF;
      IF NEW.edd IS NULL AND NEW.admitted_at IS NOT NULL THEN
        NEW.edd := (NEW.admitted_at::date + _dur);
      ELSIF NEW.edd IS NULL THEN
        NEW.edd := (CURRENT_DATE + _dur);
      END IF;
    END IF;
    IF _rt IS NOT NULL AND NEW.room_type_entitled IS NULL THEN
      NEW.room_type_entitled := _rt;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER adm_req_derive_los BEFORE INSERT OR UPDATE ON public.admission_request
  FOR EACH ROW EXECUTE FUNCTION public.admission_request_derive_los();

-- ============ bed_transfer ============
CREATE TABLE public.bed_transfer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  admission_request_id UUID NOT NULL REFERENCES public.admission_request(id) ON DELETE CASCADE,
  from_bed_type TEXT,
  to_bed_type TEXT NOT NULL,
  from_tier INTEGER,
  to_tier INTEGER,
  requires_preauth BOOLEAN NOT NULL DEFAULT false,
  authorization_request_id UUID REFERENCES public.authorization_request(id),
  status public.bed_transfer_status NOT NULL DEFAULT 'requested',
  reason TEXT,
  transferred_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bed_transfer TO authenticated;
GRANT ALL ON public.bed_transfer TO service_role;
ALTER TABLE public.bed_transfer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bed_transfer tenant read"  ON public.bed_transfer FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "bed_transfer tenant write" ON public.bed_transfer FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER bed_transfer_touch BEFORE UPDATE ON public.bed_transfer
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ los_extension ============
CREATE TABLE public.los_extension (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  admission_request_id UUID NOT NULL REFERENCES public.admission_request(id) ON DELETE CASCADE,
  prior_los_days INTEGER,
  new_los_days INTEGER NOT NULL,
  new_edd DATE,
  reason TEXT,
  authorization_request_id UUID REFERENCES public.authorization_request(id),
  status public.los_ext_status NOT NULL DEFAULT 'requested',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.los_extension TO authenticated;
GRANT ALL ON public.los_extension TO service_role;
ALTER TABLE public.los_extension ENABLE ROW LEVEL SECURITY;
CREATE POLICY "los_ext tenant read"  ON public.los_extension FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "los_ext tenant write" ON public.los_extension FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER los_ext_touch BEFORE UPDATE ON public.los_extension
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ deposit ============
CREATE TABLE public.deposit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  encounter_id UUID REFERENCES public.encounter(id) ON DELETE SET NULL,
  admission_request_id UUID REFERENCES public.admission_request(id) ON DELETE SET NULL,
  beneficiary_id UUID REFERENCES public.beneficiary(id),
  requested_minor BIGINT NOT NULL DEFAULT 0,
  amount_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  method public.deposit_method NOT NULL DEFAULT 'cash',
  status public.deposit_status NOT NULL DEFAULT 'requested',
  applied_to_bill_id UUID,        -- R6 will bind properly
  reference_no TEXT,
  received_by UUID,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID
);
CREATE INDEX deposit_admreq_idx ON public.deposit(admission_request_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deposit TO authenticated;
GRANT ALL ON public.deposit TO service_role;
ALTER TABLE public.deposit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposit tenant read"  ON public.deposit FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "deposit tenant write" ON public.deposit FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER deposit_touch BEFORE UPDATE ON public.deposit
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Recalc paid_amount_minor on admission when deposits change.
CREATE OR REPLACE FUNCTION public.deposit_recalc_admission_paid()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _adm UUID; _sum BIGINT;
BEGIN
  _adm := COALESCE(NEW.admission_request_id, OLD.admission_request_id);
  IF _adm IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(amount_minor),0) INTO _sum
    FROM public.deposit
   WHERE admission_request_id = _adm
     AND status IN ('collected','applied');
  UPDATE public.admission_request SET paid_amount_minor = _sum WHERE id = _adm;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER deposit_recalc AFTER INSERT OR UPDATE OR DELETE ON public.deposit
  FOR EACH ROW EXECUTE FUNCTION public.deposit_recalc_admission_paid();

-- ============ ip_daily_charge_run ============
CREATE TABLE public.ip_daily_charge_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  admission_request_id UUID NOT NULL REFERENCES public.admission_request(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  charges_posted INTEGER NOT NULL DEFAULT 0,
  total_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'posted',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (admission_request_id, run_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_daily_charge_run TO authenticated;
GRANT ALL ON public.ip_daily_charge_run TO service_role;
ALTER TABLE public.ip_daily_charge_run ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ipdcr tenant read"  ON public.ip_daily_charge_run FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "ipdcr tenant write" ON public.ip_daily_charge_run FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ============ Additive columns ============
ALTER TABLE public.charge_item
  ADD COLUMN IF NOT EXISTS admission_request_id UUID
    REFERENCES public.admission_request(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS charge_item_admreq_idx ON public.charge_item(admission_request_id);

ALTER TABLE public.authorization_request
  ADD COLUMN IF NOT EXISTS admission_request_id UUID
    REFERENCES public.admission_request(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auth_scope public.auth_scope;
CREATE INDEX IF NOT EXISTS authreq_admreq_idx ON public.authorization_request(admission_request_id);
