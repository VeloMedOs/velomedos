
-- ============================================================================
-- RCM R5 · Claim batching, remittance & denial management
-- ============================================================================

-- Enums (new; no ALTER TYPE on existing enums)
DO $$ BEGIN
  CREATE TYPE public.batch_integration_type AS ENUM ('moh','gosi','cchi','direct','self_pay');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.batch_status AS ENUM ('open','submitting','submitted','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.remittance_source AS ENUM ('interface','file_upload');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.remittance_status AS ENUM ('staged','matching','matched','posted','reconciliation','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.remittance_match_status AS ENUM ('unmatched','matched','mismatch','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.denial_status AS ENUM ('pending_action','in_correction','accepted','resubmitted','resolved','disposed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.denial_category AS ENUM ('technical','medical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.denial_finance_disposition AS ENUM ('none','write_off','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.claim_readiness_status AS ENUM ('ready','needs_correction','hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- claim_batch
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.claim_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  batch_no TEXT NOT NULL,
  payer_id UUID NOT NULL REFERENCES public.payer(id),
  integration_type public.batch_integration_type NOT NULL,
  status public.batch_status NOT NULL DEFAULT 'open',
  claim_count INTEGER NOT NULL DEFAULT 0,
  total_amount_minor BIGINT NOT NULL DEFAULT 0,
  cover_letter_url TEXT,
  esign_ref TEXT,
  submitted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, batch_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_batch TO authenticated;
GRANT ALL ON public.claim_batch TO service_role;
ALTER TABLE public.claim_batch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_batch tenant read" ON public.claim_batch
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "claim_batch tenant write" ON public.claim_batch
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER claim_batch_touch BEFORE UPDATE ON public.claim_batch
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS claim_batch_tenant_status_idx
  ON public.claim_batch (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS claim_batch_payer_idx
  ON public.claim_batch (tenant_id, payer_id, integration_type);

-- ---------------------------------------------------------------------------
-- claim  (additive columns + relaxed status CHECK)
-- ---------------------------------------------------------------------------
ALTER TABLE public.claim
  ADD COLUMN IF NOT EXISTS claim_sequence_no  TEXT,
  ADD COLUMN IF NOT EXISTS batch_id           UUID REFERENCES public.claim_batch(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS readiness_status   public.claim_readiness_status,
  ADD COLUMN IF NOT EXISTS snapshot_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS esign_ref          TEXT;

CREATE INDEX IF NOT EXISTS claim_seq_idx ON public.claim (tenant_id, claim_sequence_no);
CREATE INDEX IF NOT EXISTS claim_batch_idx ON public.claim (tenant_id, batch_id);

-- Replace CHECK to admit paid / part_paid / denied
ALTER TABLE public.claim DROP CONSTRAINT IF EXISTS claim_status_check;
ALTER TABLE public.claim ADD CONSTRAINT claim_status_check CHECK (
  status = ANY (ARRAY[
    'draft','assembled','scrubbing','scrub_failed','ready','auth_hold','coding_hold',
    'priced','submitted','accepted','rejected','resubmit_required','adjudicated','closed',
    'paid','part_paid','denied'
  ])
);

-- Sequence-number generator: default per-encounter grouping key.
CREATE OR REPLACE FUNCTION public.claim_set_sequence_no()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _existing TEXT;
BEGIN
  IF NEW.claim_sequence_no IS NULL OR NEW.claim_sequence_no = '' THEN
    -- Reuse the sequence-no of the claim being replaced (resubmission lineage)
    IF NEW.replaces_claim_id IS NOT NULL THEN
      SELECT claim_sequence_no INTO _existing FROM public.claim WHERE id = NEW.replaces_claim_id;
      IF _existing IS NOT NULL THEN NEW.claim_sequence_no := _existing; END IF;
    END IF;
    -- Else: any prior claim for the same encounter shares the sequence
    IF NEW.claim_sequence_no IS NULL THEN
      SELECT claim_sequence_no INTO _existing FROM public.claim
        WHERE tenant_id = NEW.tenant_id AND encounter_id = NEW.encounter_id
        AND claim_sequence_no IS NOT NULL LIMIT 1;
      IF _existing IS NOT NULL THEN NEW.claim_sequence_no := _existing; END IF;
    END IF;
    IF NEW.claim_sequence_no IS NULL THEN
      NEW.claim_sequence_no := 'CS-' || to_char(now(),'YYYY') || '-' ||
        upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS claim_set_sequence_no_trg ON public.claim;
CREATE TRIGGER claim_set_sequence_no_trg
  BEFORE INSERT ON public.claim
  FOR EACH ROW EXECUTE FUNCTION public.claim_set_sequence_no();

-- Backfill existing rows so sequence-based grouping works immediately.
UPDATE public.claim c SET claim_sequence_no = COALESCE(
  (SELECT c2.claim_sequence_no FROM public.claim c2
    WHERE c2.tenant_id = c.tenant_id AND c2.encounter_id = c.encounter_id
      AND c2.claim_sequence_no IS NOT NULL LIMIT 1),
  'CS-' || to_char(c.created_at,'YYYY') || '-' || upper(substr(replace(c.id::text,'-',''),1,6))
)
WHERE claim_sequence_no IS NULL;

-- When a claim is added to a batch, mark readiness=ready + lock the snapshot.
CREATE OR REPLACE FUNCTION public.claim_batch_advance_claim()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.batch_id IS DISTINCT FROM OLD.batch_id) THEN
    NEW.readiness_status := 'ready';
    IF NEW.snapshot_locked_at IS NULL THEN
      NEW.snapshot_locked_at := now();
    END IF;
    IF NEW.status IN ('draft','assembled','scrubbing') THEN
      NEW.status := 'ready';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS claim_batch_advance_claim_trg ON public.claim;
CREATE TRIGGER claim_batch_advance_claim_trg
  BEFORE INSERT OR UPDATE OF batch_id ON public.claim
  FOR EACH ROW EXECUTE FUNCTION public.claim_batch_advance_claim();

-- ---------------------------------------------------------------------------
-- remittance / remittance_line
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.remittance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  payer_id UUID NOT NULL REFERENCES public.payer(id),
  source public.remittance_source NOT NULL,
  remittance_ref TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount_minor BIGINT NOT NULL DEFAULT 0,
  status public.remittance_status NOT NULL DEFAULT 'staged',
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  raw_payload JSONB,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payer_id, remittance_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remittance TO authenticated;
GRANT ALL ON public.remittance TO service_role;
ALTER TABLE public.remittance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remittance tenant read" ON public.remittance FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "remittance tenant write" ON public.remittance FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER remittance_touch BEFORE UPDATE ON public.remittance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS remittance_tenant_status_idx
  ON public.remittance (tenant_id, status, received_at DESC);

CREATE TABLE IF NOT EXISTS public.remittance_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  remittance_id UUID NOT NULL REFERENCES public.remittance(id) ON DELETE CASCADE,
  claim_sequence_no TEXT,
  claim_id UUID REFERENCES public.claim(id) ON DELETE SET NULL,
  bill_ref TEXT,
  paid_amount_minor BIGINT NOT NULL DEFAULT 0,
  allocated_amount_minor BIGINT NOT NULL DEFAULT 0,
  adjustment_minor BIGINT NOT NULL DEFAULT 0,
  reason_code TEXT,
  match_status public.remittance_match_status NOT NULL DEFAULT 'unmatched',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remittance_line TO authenticated;
GRANT ALL ON public.remittance_line TO service_role;
ALTER TABLE public.remittance_line ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remittance_line tenant read" ON public.remittance_line FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "remittance_line tenant write" ON public.remittance_line FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER remittance_line_touch BEFORE UPDATE ON public.remittance_line
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS remittance_line_rem_idx
  ON public.remittance_line (remittance_id);
CREATE INDEX IF NOT EXISTS remittance_line_seq_idx
  ON public.remittance_line (tenant_id, claim_sequence_no);
CREATE INDEX IF NOT EXISTS remittance_line_claim_idx
  ON public.remittance_line (tenant_id, claim_id);

-- Post remittance to claims when the header flips to `posted`.
-- Settles per claim: paid_amount_minor + total_payer_share_minor projection and
-- flips claim.status to paid/part_paid/denied based on aggregate coverage.
CREATE OR REPLACE FUNCTION public.remittance_post_apply()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r RECORD; _paid BIGINT; _target BIGINT; _new_status TEXT;
BEGIN
  IF NEW.status = 'posted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'posted') THEN
    NEW.posted_at := COALESCE(NEW.posted_at, now());
    FOR r IN
      SELECT claim_id, SUM(paid_amount_minor)::BIGINT AS paid,
             SUM(adjustment_minor)::BIGINT AS adj
        FROM public.remittance_line
       WHERE remittance_id = NEW.id AND claim_id IS NOT NULL
       GROUP BY claim_id
    LOOP
      SELECT total_payer_share_minor INTO _target FROM public.claim WHERE id = r.claim_id;
      _paid := COALESCE(r.paid, 0);
      IF _paid <= 0 THEN
        _new_status := 'denied';
      ELSIF _target IS NOT NULL AND _paid < _target THEN
        _new_status := 'part_paid';
      ELSE
        _new_status := 'paid';
      END IF;
      UPDATE public.claim SET status = _new_status, updated_at = now()
        WHERE id = r.claim_id;
      -- Advance encounter journey
      PERFORM public.encounter_advance_journey(
        (SELECT encounter_id FROM public.claim WHERE id = r.claim_id),
        CASE WHEN _new_status = 'denied' THEN 'denied' ELSE 'settled' END
      );
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS remittance_post_apply_trg ON public.remittance;
CREATE TRIGGER remittance_post_apply_trg
  BEFORE UPDATE OF status ON public.remittance
  FOR EACH ROW EXECUTE FUNCTION public.remittance_post_apply();

-- ---------------------------------------------------------------------------
-- denial_case / denial_communication
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.denial_case (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  claim_sequence_no TEXT NOT NULL,
  claim_id UUID NOT NULL REFERENCES public.claim(id) ON DELETE CASCADE,
  status public.denial_status NOT NULL DEFAULT 'pending_action',
  denial_category public.denial_category,
  denial_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  item_level_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  followup_no INTEGER NOT NULL DEFAULT 0,
  last_comm_at TIMESTAMPTZ,
  finance_disposition public.denial_finance_disposition NOT NULL DEFAULT 'none',
  disposition_amount_minor BIGINT NOT NULL DEFAULT 0,
  disposition_note TEXT,
  disposed_at TIMESTAMPTZ,
  disposed_by UUID,
  replaces_claim_id UUID REFERENCES public.claim(id),
  assigned_to UUID,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, claim_sequence_no, claim_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.denial_case TO authenticated;
GRANT ALL ON public.denial_case TO service_role;
ALTER TABLE public.denial_case ENABLE ROW LEVEL SECURITY;
CREATE POLICY "denial_case tenant read" ON public.denial_case FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "denial_case tenant write" ON public.denial_case FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER denial_case_touch BEFORE UPDATE ON public.denial_case
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS denial_case_tenant_status_idx
  ON public.denial_case (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS denial_case_seq_idx
  ON public.denial_case (tenant_id, claim_sequence_no);

CREATE TABLE IF NOT EXISTS public.denial_communication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  denial_case_id UUID NOT NULL REFERENCES public.denial_case(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound','internal')),
  channel TEXT,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.denial_communication TO authenticated;
GRANT ALL ON public.denial_communication TO service_role;
ALTER TABLE public.denial_communication ENABLE ROW LEVEL SECURITY;
CREATE POLICY "denial_comm tenant read" ON public.denial_communication FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "denial_comm tenant write" ON public.denial_communication FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER denial_comm_touch BEFORE UPDATE ON public.denial_communication
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS denial_comm_case_idx
  ON public.denial_communication (denial_case_id, occurred_at DESC);

-- Bump denial_case.followup_no + last_comm_at on communication insert.
CREATE OR REPLACE FUNCTION public.denial_comm_bump_case()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.denial_case
     SET followup_no = followup_no + CASE WHEN NEW.direction = 'outbound' THEN 1 ELSE 0 END,
         last_comm_at = NEW.occurred_at,
         updated_at = now()
   WHERE id = NEW.denial_case_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS denial_comm_bump_case_trg ON public.denial_communication;
CREATE TRIGGER denial_comm_bump_case_trg
  AFTER INSERT ON public.denial_communication
  FOR EACH ROW EXECUTE FUNCTION public.denial_comm_bump_case();

-- Auto-open a denial case when a claim receives a rejected/partial adjudication.
CREATE OR REPLACE FUNCTION public.denial_case_from_response()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _cat public.denial_category;
BEGIN
  IF (NEW.status IN ('rejected','denied','resubmit_required')
      OR NEW.adjudication_outcome = 'partial')
     AND (TG_OP = 'INSERT'
          OR NEW.status IS DISTINCT FROM OLD.status
          OR NEW.adjudication_outcome IS DISTINCT FROM OLD.adjudication_outcome)
     AND NEW.claim_sequence_no IS NOT NULL THEN
    _cat := CASE WHEN NEW.adjudication_outcome = 'partial' THEN 'medical'::public.denial_category
                 ELSE 'technical'::public.denial_category END;
    INSERT INTO public.denial_case (tenant_id, claim_sequence_no, claim_id, status, denial_category)
    VALUES (NEW.tenant_id, NEW.claim_sequence_no, NEW.id, 'pending_action', _cat)
    ON CONFLICT (tenant_id, claim_sequence_no, claim_id) DO UPDATE
       SET status = CASE WHEN public.denial_case.status IN ('resolved','disposed')
                         THEN public.denial_case.status ELSE 'pending_action' END,
           updated_at = now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS denial_case_from_response_trg ON public.claim;
CREATE TRIGGER denial_case_from_response_trg
  AFTER INSERT OR UPDATE OF status, adjudication_outcome ON public.claim
  FOR EACH ROW EXECUTE FUNCTION public.denial_case_from_response();
