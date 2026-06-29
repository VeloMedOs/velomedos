
-- Phase 9 — NPHIES gateway

ALTER TABLE public.claim
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS nphies_request jsonb,
  ADD COLUMN IF NOT EXISTS nphies_claim_id text,
  ADD COLUMN IF NOT EXISTS eligibility_response jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjudicated_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjudication_outcome text
    CHECK (adjudication_outcome IS NULL OR adjudication_outcome IN ('complete','partial','error'));

CREATE UNIQUE INDEX IF NOT EXISTS claim_tenant_idem_uq
  ON public.claim(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.claim_item
  ADD COLUMN IF NOT EXISTS adjudicated_payer_share_minor integer,
  ADD COLUMN IF NOT EXISTS adjudicated_patient_share_minor integer,
  ADD COLUMN IF NOT EXISTS adjudicated_net_minor integer,
  ADD COLUMN IF NOT EXISTS adjudication_reason text;

CREATE TABLE IF NOT EXISTS public.claim_submission_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  claim_id uuid NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL,
  idempotency_key text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  http_status integer,
  outcome text NOT NULL CHECK (outcome IN ('in_flight','ok','error')),
  error text,
  sandbox boolean NOT NULL DEFAULT false,
  request_body jsonb,
  response_body jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS csa_claim_idx ON public.claim_submission_attempt(claim_id, attempt_no DESC);
CREATE UNIQUE INDEX IF NOT EXISTS csa_single_flight
  ON public.claim_submission_attempt(claim_id) WHERE outcome = 'in_flight';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_submission_attempt TO authenticated;
GRANT ALL ON public.claim_submission_attempt TO service_role;
ALTER TABLE public.claim_submission_attempt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csa tenant select" ON public.claim_submission_attempt FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "csa tenant write" ON public.claim_submission_attempt FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "csa service" ON public.claim_submission_attempt FOR ALL TO service_role USING (true) WITH CHECK (true);
