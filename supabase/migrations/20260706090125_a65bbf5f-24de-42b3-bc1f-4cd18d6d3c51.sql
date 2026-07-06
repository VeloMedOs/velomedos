-- M12: Referral data layer (data-only; screens ship in Step 5).

CREATE TABLE public.referral (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  referral_no text NOT NULL,
  source_encounter_id uuid NULL,
  source_provider_id uuid NULL,
  source_specialty text NULL,
  beneficiary_id uuid NOT NULL,
  referral_class public.referral_class NOT NULL,
  charge_mode public.charge_mode NULL,
  status public.referral_status NOT NULL DEFAULT 'draft',
  reason text NULL,
  priority text NULL,
  clinical_notes text NULL,
  external_facility text NULL,
  external_provider text NULL,
  eligibility_check_required boolean NOT NULL DEFAULT false,
  preauth_required boolean NOT NULL DEFAULT false,
  discount_pct numeric NULL,
  no_charge_reason text NULL,
  series_id uuid NULL,
  submitted_at timestamptz NULL,
  accepted_at timestamptz NULL,
  completed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  cancel_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_by uuid NULL,
  UNIQUE (tenant_id, referral_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral TO authenticated;
GRANT ALL ON public.referral TO service_role;
ALTER TABLE public.referral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read referral" ON public.referral FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members manage referral" ON public.referral FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE INDEX referral_beneficiary_idx ON public.referral(tenant_id, beneficiary_id);
CREATE INDEX referral_source_encounter_idx ON public.referral(source_encounter_id) WHERE source_encounter_id IS NOT NULL;
CREATE INDEX referral_status_idx ON public.referral(tenant_id, status);
CREATE TRIGGER trg_referral_updated_at BEFORE UPDATE ON public.referral
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.referral_target (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  referral_id uuid NOT NULL REFERENCES public.referral(id) ON DELETE CASCADE,
  target_kind public.target_kind NOT NULL,
  target_specialty text NULL,
  target_provider_id uuid NULL,
  target_facility_id uuid NULL,
  target_service_id uuid NULL,
  status public.referral_status NOT NULL DEFAULT 'submitted',
  booked_appointment_id uuid NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_target TO authenticated;
GRANT ALL ON public.referral_target TO service_role;
ALTER TABLE public.referral_target ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read referral_target" ON public.referral_target FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Tenant members manage referral_target" ON public.referral_target FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE INDEX referral_target_referral_idx ON public.referral_target(referral_id);
CREATE TRIGGER trg_referral_target_updated_at BEFORE UPDATE ON public.referral_target
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();