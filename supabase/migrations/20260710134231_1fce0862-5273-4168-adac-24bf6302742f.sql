-- M-S4T5-01 · Beneficiary additive demographic columns
ALTER TABLE public.beneficiary
  ADD COLUMN IF NOT EXISTS occupation_ar text NULL,
  ADD COLUMN IF NOT EXISTS occupation_en text NULL,
  ADD COLUMN IF NOT EXISTS country_code text NULL,
  ADD COLUMN IF NOT EXISTS father_mrn text NULL,
  ADD COLUMN IF NOT EXISTS is_newborn_under_mother boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.beneficiary.dob IS 'Gregorian only; Hijri computed client-side per HCA-0051.';

-- M-S4T5-02 · Constrain eligibility_type per file 14 §②
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visit_eligibility_type_check') THEN
    ALTER TABLE public.visit_eligibility
      ADD CONSTRAINT visit_eligibility_type_check
      CHECK (eligibility_type IN ('standard','referral','emergency','newborn'));
  END IF;
END $$;

-- M-S4T5-03 · Clinic disruption event log (bulk cancel/reschedule/reassign)
CREATE TABLE IF NOT EXISTS public.clinic_disruption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  slot_at_from timestamptz NOT NULL,
  slot_at_to timestamptz NOT NULL,
  reason text NOT NULL,
  action text NOT NULL CHECK (action IN ('cancel','reschedule','reassign')),
  reassign_target_clinic_id uuid NULL REFERENCES public.clinics(id) ON DELETE SET NULL,
  affected_count integer NOT NULL DEFAULT 0,
  cancellation_charge boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinic_disruption_tenant_idx ON public.clinic_disruption(tenant_id, clinic_id, slot_at_from);

GRANT SELECT, INSERT ON public.clinic_disruption TO authenticated;
GRANT ALL ON public.clinic_disruption TO service_role;

ALTER TABLE public.clinic_disruption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_disruption tenant read"
  ON public.clinic_disruption FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "clinic_disruption tenant insert"
  ON public.clinic_disruption FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()));

CREATE POLICY "clinic_disruption service"
  ON public.clinic_disruption FOR ALL TO service_role
  USING (true) WITH CHECK (true);