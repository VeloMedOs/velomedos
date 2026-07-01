
-- ============================================================================
-- R6 Migration 2/2 — Deposits, Refunds, Wallet, Credit Notes, ERP posting
-- ============================================================================

-- 1. New enum for deposit types (safe to create + use same-txn since new).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deposit_type') THEN
    CREATE TYPE public.deposit_type AS ENUM (
      'general','encounter','department','billing_group','order_item','caution'
    );
  END IF;
END $$;

-- 2. Extend `deposit` (additive — never re-add existing columns).
ALTER TABLE public.deposit
  ADD COLUMN IF NOT EXISTS deposit_no       TEXT,
  ADD COLUMN IF NOT EXISTS deposit_type     public.deposit_type NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS scope_ref_id     UUID,
  ADD COLUMN IF NOT EXISTS is_caution       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_minor  BIGINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_reference    TEXT,
  ADD COLUMN IF NOT EXISTS collected_by     UUID,
  ADD COLUMN IF NOT EXISTS erp_posting_ref  TEXT,
  ADD COLUMN IF NOT EXISTS erp_posted_at    TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS deposit_no_uq ON public.deposit(tenant_id, deposit_no) WHERE deposit_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS deposit_ben_idx  ON public.deposit(beneficiary_id);
CREATE INDEX IF NOT EXISTS deposit_enc_idx  ON public.deposit(encounter_id);
CREATE INDEX IF NOT EXISTS deposit_status_idx ON public.deposit(tenant_id, status);

-- Assign deposit_no + initialize available_minor on insert.
CREATE OR REPLACE FUNCTION public.deposit_set_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.deposit_no IS NULL OR NEW.deposit_no = '' THEN
    NEW.deposit_no := 'DEP-' || to_char(now(),'YYYY') || '-' ||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  END IF;
  IF TG_OP = 'INSERT' AND NEW.status IN ('collected','held') THEN
    NEW.available_minor := COALESCE(NEW.amount_minor, 0);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deposit_set_defaults_bi ON public.deposit;
CREATE TRIGGER deposit_set_defaults_bi BEFORE INSERT ON public.deposit
  FOR EACH ROW EXECUTE FUNCTION public.deposit_set_defaults();

-- Extend admission-recalc to include new statuses (kept from R4, superseded).
CREATE OR REPLACE FUNCTION public.deposit_recalc_admission_paid()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _adm UUID; _sum BIGINT;
BEGIN
  _adm := COALESCE(NEW.admission_request_id, OLD.admission_request_id);
  IF _adm IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(amount_minor - COALESCE(available_minor,0)),0) INTO _sum
    FROM public.deposit
   WHERE admission_request_id = _adm
     AND status IN ('collected','applied','partially_applied');
  UPDATE public.admission_request SET paid_amount_minor = _sum WHERE id = _adm;
  RETURN COALESCE(NEW, OLD);
END $$;

-- ============================================================================
-- 3. deposit_transaction — immutable ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deposit_transaction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deposit_id UUID NOT NULL REFERENCES public.deposit(id) ON DELETE CASCADE,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('collect','apply','refund','transfer','credit_note','adjustment')),
  amount_minor BIGINT NOT NULL,
  method public.deposit_method,
  applied_to_claim_id UUID,
  transferred_to_deposit_id UUID REFERENCES public.deposit(id) ON DELETE SET NULL,
  refund_request_id UUID,
  credit_note_id UUID,
  reason TEXT,
  approved_by UUID,
  receipt_no TEXT,
  erp_posting_ref TEXT,
  erp_posted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deposit_txn_dep_idx    ON public.deposit_transaction(deposit_id);
CREATE INDEX IF NOT EXISTS deposit_txn_tenant_idx ON public.deposit_transaction(tenant_id);
GRANT SELECT, INSERT ON public.deposit_transaction TO authenticated;
GRANT ALL ON public.deposit_transaction TO service_role;
ALTER TABLE public.deposit_transaction ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposit_txn tenant read"  ON public.deposit_transaction FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "deposit_txn tenant write" ON public.deposit_transaction FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ============================================================================
-- 4. deposit_attachment — consents / financial forms
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.deposit_attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deposit_id UUID NOT NULL REFERENCES public.deposit(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  note TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deposit_att_dep_idx ON public.deposit_attachment(deposit_id);
GRANT SELECT, INSERT, DELETE ON public.deposit_attachment TO authenticated;
GRANT ALL ON public.deposit_attachment TO service_role;
ALTER TABLE public.deposit_attachment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposit_att tenant read"  ON public.deposit_attachment FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "deposit_att tenant write" ON public.deposit_attachment FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ============================================================================
-- 5. refund_request
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.refund_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  deposit_id UUID NOT NULL REFERENCES public.deposit(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  original_method public.deposit_method NOT NULL,
  refund_method TEXT NOT NULL CHECK (refund_method IN ('cash','bank_transfer','card_reversal')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','executed','held')),
  approval_level TEXT,
  approved_by UUID,
  approval_reason TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  executed_by UUID,
  receipt_no TEXT,
  exception_override BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refund_req_status_idx ON public.refund_request(tenant_id, status);
CREATE INDEX IF NOT EXISTS refund_req_dep_idx    ON public.refund_request(deposit_id);
GRANT SELECT, INSERT, UPDATE ON public.refund_request TO authenticated;
GRANT ALL ON public.refund_request TO service_role;
ALTER TABLE public.refund_request ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refund_req tenant read"  ON public.refund_request FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "refund_req tenant write" ON public.refund_request FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER refund_req_touch BEFORE UPDATE ON public.refund_request
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.refund_request_attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  refund_request_id UUID NOT NULL REFERENCES public.refund_request(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  note TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refund_att_req_idx ON public.refund_request_attachment(refund_request_id);
GRANT SELECT, INSERT, DELETE ON public.refund_request_attachment TO authenticated;
GRANT ALL ON public.refund_request_attachment TO service_role;
ALTER TABLE public.refund_request_attachment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refund_att tenant read"  ON public.refund_request_attachment FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "refund_att tenant write" ON public.refund_request_attachment FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ============================================================================
-- 6. patient_wallet + wallet_txn + credit_note
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.patient_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  beneficiary_id UUID NOT NULL REFERENCES public.beneficiary(id) ON DELETE CASCADE,
  balance_minor BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, beneficiary_id)
);
GRANT SELECT, INSERT, UPDATE ON public.patient_wallet TO authenticated;
GRANT ALL ON public.patient_wallet TO service_role;
ALTER TABLE public.patient_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet tenant read"  ON public.patient_wallet FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "wallet tenant write" ON public.patient_wallet FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER wallet_touch BEFORE UPDATE ON public.patient_wallet
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.wallet_txn (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  wallet_id UUID NOT NULL REFERENCES public.patient_wallet(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  source TEXT NOT NULL CHECK (source IN ('credit_note','refund','manual','apply_to_bill','deposit_convert')),
  source_ref_id UUID,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_txn_wallet_idx ON public.wallet_txn(wallet_id);
GRANT SELECT, INSERT ON public.wallet_txn TO authenticated;
GRANT ALL ON public.wallet_txn TO service_role;
ALTER TABLE public.wallet_txn ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_txn tenant read"  ON public.wallet_txn FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "wallet_txn tenant write" ON public.wallet_txn FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- Maintain wallet balance from wallet_txn.
CREATE OR REPLACE FUNCTION public.wallet_txn_apply()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.patient_wallet
     SET balance_minor = balance_minor + (CASE WHEN NEW.direction = 'credit' THEN NEW.amount_minor ELSE -NEW.amount_minor END),
         updated_at = now()
   WHERE id = NEW.wallet_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wallet_txn_apply_ai ON public.wallet_txn;
CREATE TRIGGER wallet_txn_apply_ai AFTER INSERT ON public.wallet_txn
  FOR EACH ROW EXECUTE FUNCTION public.wallet_txn_apply();

CREATE TABLE IF NOT EXISTS public.credit_note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  beneficiary_id UUID NOT NULL REFERENCES public.beneficiary(id),
  encounter_id UUID REFERENCES public.encounter(id) ON DELETE SET NULL,
  cn_no TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','applied','void')),
  wallet_txn_id UUID REFERENCES public.wallet_txn(id) ON DELETE SET NULL,
  source_charge_ref UUID,
  erp_posting_ref TEXT,
  erp_posted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS credit_note_no_uq ON public.credit_note(tenant_id, cn_no) WHERE cn_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS credit_note_ben_idx ON public.credit_note(beneficiary_id);
GRANT SELECT, INSERT, UPDATE ON public.credit_note TO authenticated;
GRANT ALL ON public.credit_note TO service_role;
ALTER TABLE public.credit_note ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cn tenant read"  ON public.credit_note FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cn tenant write" ON public.credit_note FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER cn_touch BEFORE UPDATE ON public.credit_note
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Assign cn_no on insert.
CREATE OR REPLACE FUNCTION public.credit_note_set_no()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.cn_no IS NULL OR NEW.cn_no = '' THEN
    NEW.cn_no := 'CN-' || to_char(now(),'YYYY') || '-' ||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS credit_note_set_no_bi ON public.credit_note;
CREATE TRIGGER credit_note_set_no_bi BEFORE INSERT ON public.credit_note
  FOR EACH ROW EXECUTE FUNCTION public.credit_note_set_no();

-- ============================================================================
-- 7. erp_posting_queue — contract only; R7 builds the D365 connector.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.erp_posting_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('deposit_txn','refund','credit_note','remittance')),
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','failed','dead')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  posting_ref TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_queue_status_idx ON public.erp_posting_queue(tenant_id, status);
CREATE INDEX IF NOT EXISTS erp_queue_entity_idx ON public.erp_posting_queue(entity_type, entity_id);
GRANT SELECT, INSERT, UPDATE ON public.erp_posting_queue TO authenticated;
GRANT ALL ON public.erp_posting_queue TO service_role;
ALTER TABLE public.erp_posting_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_queue tenant read"  ON public.erp_posting_queue FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "erp_queue tenant write" ON public.erp_posting_queue FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE TRIGGER erp_queue_touch BEFORE UPDATE ON public.erp_posting_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 8. Trigger: deposit_transaction → recompute deposit balance + status + ERP enqueue
-- ============================================================================
CREATE OR REPLACE FUNCTION public.deposit_txn_apply()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _d RECORD; _new_avail BIGINT; _new_status public.deposit_status;
BEGIN
  SELECT * INTO _d FROM public.deposit WHERE id = NEW.deposit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- caution guard: cannot apply to bill unless reason begins with 'OVERRIDE:' AND an approver present
  IF NEW.txn_type = 'apply' AND _d.is_caution = true
     AND (NEW.approved_by IS NULL OR NEW.reason IS NULL OR NEW.reason NOT LIKE 'OVERRIDE:%') THEN
    RAISE EXCEPTION 'CAUTION_CANNOT_SETTLE: caution deposit % cannot be applied without approved override', _d.deposit_no;
  END IF;

  IF NEW.txn_type = 'collect' THEN
    _new_avail := _d.available_minor + NEW.amount_minor;
  ELSIF NEW.txn_type IN ('apply','refund','transfer','credit_note') THEN
    _new_avail := _d.available_minor - NEW.amount_minor;
  ELSE
    _new_avail := _d.available_minor; -- adjustment: caller sets available separately
  END IF;
  IF _new_avail < 0 THEN
    RAISE EXCEPTION 'DEPOSIT_OVERDRAW: deposit % would go negative (avail=%, txn=%)', _d.deposit_no, _d.available_minor, NEW.amount_minor;
  END IF;

  -- status projection
  _new_status := _d.status;
  IF NEW.txn_type = 'refund' AND _new_avail = 0 THEN _new_status := 'refunded';
  ELSIF NEW.txn_type = 'transfer' AND _new_avail = 0 THEN _new_status := 'transferred';
  ELSIF NEW.txn_type = 'apply' AND _new_avail = 0 THEN _new_status := 'applied';
  ELSIF NEW.txn_type = 'apply' AND _new_avail > 0 AND _new_avail < _d.amount_minor THEN _new_status := 'partially_applied';
  ELSIF NEW.txn_type = 'collect' AND _d.status = 'requested' THEN _new_status := 'collected';
  END IF;

  UPDATE public.deposit
     SET available_minor = _new_avail,
         status = _new_status,
         applied_to_bill_id = COALESCE(NEW.applied_to_claim_id, _d.applied_to_bill_id),
         updated_at = now()
   WHERE id = _d.id;

  -- ERP posting contract — every txn queued.
  INSERT INTO public.erp_posting_queue (tenant_id, entity_type, entity_id, payload)
  VALUES (
    NEW.tenant_id, 'deposit_txn', NEW.id,
    jsonb_build_object(
      'deposit_no', _d.deposit_no,
      'txn_type', NEW.txn_type,
      'amount_minor', NEW.amount_minor,
      'method', NEW.method,
      'receipt_no', NEW.receipt_no,
      'applied_to_claim_id', NEW.applied_to_claim_id,
      'reason', NEW.reason
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deposit_txn_apply_ai ON public.deposit_transaction;
CREATE TRIGGER deposit_txn_apply_ai AFTER INSERT ON public.deposit_transaction
  FOR EACH ROW EXECUTE FUNCTION public.deposit_txn_apply();

-- ============================================================================
-- 9. Trigger: refund_request method + hold guards
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refund_method_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _expected TEXT;
BEGIN
  -- Default same-method mapping.
  _expected := CASE NEW.original_method
                 WHEN 'cash'          THEN 'cash'
                 WHEN 'bank_transfer' THEN 'bank_transfer'
                 WHEN 'card'          THEN 'card_reversal'
                 WHEN 'wallet'        THEN 'bank_transfer'
                 WHEN 'insurance'     THEN 'bank_transfer'
                 ELSE NULL END;
  IF _expected IS NOT NULL
     AND NEW.refund_method IS DISTINCT FROM _expected
     AND NEW.exception_override = false THEN
    RAISE EXCEPTION 'REFUND_METHOD_MISMATCH: refund method % differs from original % without approved exception',
                    NEW.refund_method, NEW.original_method;
  END IF;
  IF NEW.exception_override = true AND (NEW.approval_reason IS NULL OR length(NEW.approval_reason) < 3) THEN
    RAISE EXCEPTION 'REFUND_REASON_REQUIRED: exception override requires approval_reason';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS refund_method_guard_biu ON public.refund_request;
CREATE TRIGGER refund_method_guard_biu BEFORE INSERT OR UPDATE OF refund_method, exception_override, approval_reason
  ON public.refund_request FOR EACH ROW EXECUTE FUNCTION public.refund_method_guard();

-- ============================================================================
-- 10. Trigger: credit_note issuance → wallet credit + ERP enqueue
-- ============================================================================
CREATE OR REPLACE FUNCTION public.credit_note_apply()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _wallet UUID; _txn UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'issued' THEN
    -- Ensure wallet exists.
    SELECT id INTO _wallet FROM public.patient_wallet
      WHERE tenant_id = NEW.tenant_id AND beneficiary_id = NEW.beneficiary_id;
    IF _wallet IS NULL THEN
      INSERT INTO public.patient_wallet (tenant_id, beneficiary_id)
      VALUES (NEW.tenant_id, NEW.beneficiary_id)
      RETURNING id INTO _wallet;
    END IF;
    INSERT INTO public.wallet_txn (tenant_id, wallet_id, direction, source, source_ref_id, amount_minor, reason, created_by)
    VALUES (NEW.tenant_id, _wallet, 'credit', 'credit_note', NEW.id, NEW.amount_minor, NEW.reason, NEW.created_by)
    RETURNING id INTO _txn;
    NEW.wallet_txn_id := _txn;
    NEW.status := 'applied';
    INSERT INTO public.erp_posting_queue (tenant_id, entity_type, entity_id, payload)
    VALUES (NEW.tenant_id, 'credit_note', NEW.id,
            jsonb_build_object('cn_no', NEW.cn_no, 'amount_minor', NEW.amount_minor, 'reason', NEW.reason));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS credit_note_apply_bi ON public.credit_note;
CREATE TRIGGER credit_note_apply_bi BEFORE INSERT ON public.credit_note
  FOR EACH ROW EXECUTE FUNCTION public.credit_note_apply();

-- ============================================================================
-- 11. Trigger: refund executed → enqueue ERP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refund_request_erp_enqueue()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'executed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'executed') THEN
    INSERT INTO public.erp_posting_queue (tenant_id, entity_type, entity_id, payload)
    VALUES (NEW.tenant_id, 'refund', NEW.id,
            jsonb_build_object('amount_minor', NEW.amount_minor,
                               'refund_method', NEW.refund_method,
                               'original_method', NEW.original_method,
                               'exception_override', NEW.exception_override,
                               'receipt_no', NEW.receipt_no));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS refund_request_erp_enqueue_aiu ON public.refund_request;
CREATE TRIGGER refund_request_erp_enqueue_aiu AFTER INSERT OR UPDATE OF status ON public.refund_request
  FOR EACH ROW EXECUTE FUNCTION public.refund_request_erp_enqueue();
