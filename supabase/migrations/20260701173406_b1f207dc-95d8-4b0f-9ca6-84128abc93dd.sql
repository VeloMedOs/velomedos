
-- Enum ----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'authorization_status') THEN
    CREATE TYPE public.authorization_status AS ENUM (
      'new','scrubbing','ready_to_submit','submitted','queued_at_payer',
      'in_review','more_info_requested','approved','partially_approved',
      'rejected','expired','cancelled','appealed','appeal_approved',
      'appeal_rejected','converted_to_self_pay','closed'
    );
  END IF;
END $$;

-- Master column adds --------------------------------------------------------
ALTER TABLE public.service_master
  ADD COLUMN IF NOT EXISTS preauth_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_category text;
ALTER TABLE public.drug_master
  ADD COLUMN IF NOT EXISTS preauth_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sub_category text;

-- Header --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.authorization_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  encounter_id uuid REFERENCES public.encounter(id) ON DELETE SET NULL,
  beneficiary_id uuid,
  coverage_id uuid,
  eligibility_ref uuid REFERENCES public.visit_eligibility(id) ON DELETE SET NULL,
  payer_id uuid REFERENCES public.payer(id) ON DELETE SET NULL,
  policy_id uuid REFERENCES public.policy(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.insurance_class(id) ON DELETE SET NULL,
  status public.authorization_status NOT NULL DEFAULT 'new',
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','emergency')),
  requested_by uuid,
  assigned_to uuid,
  submitted_at timestamptz,
  decision_at timestamptz,
  valid_from date,
  valid_to date,
  preauth_ref text,
  gateway_message_id uuid,
  gateway_response jsonb,
  decision_reason text,
  reasons_triggered jsonb NOT NULL DEFAULT '[]'::jsonb,
  locked_by uuid,
  locked_at timestamptz,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ar_tenant_status_idx ON public.authorization_request(tenant_id, status);
CREATE INDEX IF NOT EXISTS ar_tenant_encounter_idx ON public.authorization_request(tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS ar_tenant_valid_to_idx ON public.authorization_request(tenant_id, valid_to);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorization_request TO authenticated;
GRANT ALL ON public.authorization_request TO service_role;
ALTER TABLE public.authorization_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY ar_tenant_rw ON public.authorization_request FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY ar_service ON public.authorization_request FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER ar_touch BEFORE UPDATE ON public.authorization_request
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Items ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.authorization_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  authorization_request_id uuid NOT NULL REFERENCES public.authorization_request(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('service','drug')),
  service_id uuid REFERENCES public.service_master(id) ON DELETE SET NULL,
  drug_id uuid REFERENCES public.drug_master(id) ON DELETE SET NULL,
  charge_item_id uuid REFERENCES public.charge_item(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 1,
  quantity_code text,
  approved_quantity numeric,
  decision text CHECK (decision IN ('pending','approved','partial','rejected')) DEFAULT 'pending',
  benefit_amount_minor bigint,
  currency text DEFAULT 'SAR',
  reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_tenant_req_idx ON public.authorization_item(tenant_id, authorization_request_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorization_item TO authenticated;
GRANT ALL ON public.authorization_item TO service_role;
ALTER TABLE public.authorization_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_tenant_rw ON public.authorization_item FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY ai_service ON public.authorization_item FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER ai_touch BEFORE UPDATE ON public.authorization_item
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Attachments ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.authorization_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  authorization_request_id uuid NOT NULL REFERENCES public.authorization_request(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text,
  url text NOT NULL,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aatt_tenant_req_idx ON public.authorization_attachment(tenant_id, authorization_request_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorization_attachment TO authenticated;
GRANT ALL ON public.authorization_attachment TO service_role;
ALTER TABLE public.authorization_attachment ENABLE ROW LEVEL SECURITY;
CREATE POLICY aatt_tenant_rw ON public.authorization_attachment FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY aatt_service ON public.authorization_attachment FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Communications ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.authorization_communication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  authorization_request_id uuid NOT NULL REFERENCES public.authorization_request(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound','internal')),
  channel text NOT NULL DEFAULT 'note' CHECK (channel IN ('note','nphies','phone','email','portal')),
  author uuid,
  body text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acom_tenant_req_idx ON public.authorization_communication(tenant_id, authorization_request_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authorization_communication TO authenticated;
GRANT ALL ON public.authorization_communication TO service_role;
ALTER TABLE public.authorization_communication ENABLE ROW LEVEL SECURITY;
CREATE POLICY acom_tenant_rw ON public.authorization_communication FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY acom_service ON public.authorization_communication FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Approval rule master ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  payer_id uuid REFERENCES public.payer(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.policy(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.insurance_class(id) ON DELETE CASCADE,
  scope text NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_decision text CHECK (auto_decision IN ('approve','partial','reject','review')) DEFAULT 'review',
  default_valid_days int,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aprvr_tenant_scope_idx ON public.approval_rule(tenant_id, scope, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_rule TO authenticated;
GRANT ALL ON public.approval_rule TO service_role;
ALTER TABLE public.approval_rule ENABLE ROW LEVEL SECURITY;
CREATE POLICY aprvr_tenant_rw ON public.approval_rule FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY aprvr_service ON public.approval_rule FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER aprvr_touch BEFORE UPDATE ON public.approval_rule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
