
-- ============================================================================
-- RCM R7 — Cash Management + ZATCA E-Invoicing + Interfaces (capstone)
-- ============================================================================

-- ─── 1. ENUMS (new only; no ADD VALUE on existing enums) ────────────────────
DO $$ BEGIN CREATE TYPE public.cash_method AS ENUM ('cash','pos','bank_transfer','cheque','online'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.cash_status AS ENUM ('draft','posted','voided'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.cash_session_status AS ENUM ('open','closed','reconciled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tax_invoice_type AS ENUM ('b2b_insurance','b2c_patient','direct_company','credit_note','debit_note'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.zatca_status AS ENUM ('pending','cleared','reported','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tax_reporting_box AS ENUM ('insurance_output','patient_output','direct_output','refund_adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.interface_direction AS ENUM ('inbound','outbound','bidirectional'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.interface_msg_status AS ENUM ('queued','sent','ack','failed','retrying','dead'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.mapping_type AS ENUM ('dept_nphies','cost_erp','kayan_ext','order_tariff_payer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. cash_session ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  session_no TEXT,
  cashier_id UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_float_minor BIGINT NOT NULL DEFAULT 0,
  expected_minor BIGINT NOT NULL DEFAULT 0,
  counted_minor BIGINT,
  variance_minor BIGINT,
  status public.cash_session_status NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_session TO authenticated;
GRANT ALL ON public.cash_session TO service_role;
ALTER TABLE public.cash_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_session tenant read"  ON public.cash_session FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cash_session tenant write" ON public.cash_session FOR ALL    TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE INDEX IF NOT EXISTS ix_cash_session_tenant_open ON public.cash_session(tenant_id, status);

-- ─── 3. cash_collection ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  receipt_no TEXT,
  session_id UUID REFERENCES public.cash_session(id) ON DELETE SET NULL,
  cashier_id UUID,
  beneficiary_id UUID,
  encounter_id UUID,
  claim_id UUID,
  method public.cash_method NOT NULL,
  gross_minor BIGINT NOT NULL DEFAULT 0,
  rounding_minor BIGINT NOT NULL DEFAULT 0,
  deposit_applied_minor BIGINT NOT NULL DEFAULT 0,
  wallet_applied_minor BIGINT NOT NULL DEFAULT 0,
  cn_applied_minor BIGINT NOT NULL DEFAULT 0,
  net_collected_minor BIGINT NOT NULL DEFAULT 0,
  outstanding_after_minor BIGINT NOT NULL DEFAULT 0,
  pos_ref TEXT,
  bank_ref TEXT,
  bank_ref_attachment_url TEXT,
  cheque_no TEXT,
  cheque_date DATE,
  online_ref TEXT,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status public.cash_status NOT NULL DEFAULT 'draft',
  posted_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_collection TO authenticated;
GRANT ALL ON public.cash_collection TO service_role;
ALTER TABLE public.cash_collection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_collection tenant read"  ON public.cash_collection FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cash_collection tenant write" ON public.cash_collection FOR ALL    TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE INDEX IF NOT EXISTS ix_cash_collection_tenant ON public.cash_collection(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_cash_collection_claim  ON public.cash_collection(claim_id);
CREATE INDEX IF NOT EXISTS ix_cash_collection_bene   ON public.cash_collection(beneficiary_id);
CREATE INDEX IF NOT EXISTS ix_cash_collection_session ON public.cash_collection(session_id);

-- ─── 4. cash_session_txn (rollup) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_session_txn (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.cash_session(id) ON DELETE CASCADE,
  txn_kind TEXT NOT NULL CHECK (txn_kind IN ('collection','refund','adjustment')),
  cash_collection_id UUID REFERENCES public.cash_collection(id) ON DELETE SET NULL,
  refund_request_id UUID,
  method public.cash_method,
  amount_minor BIGINT NOT NULL DEFAULT 0,
  direction TEXT NOT NULL DEFAULT 'in' CHECK (direction IN ('in','out')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_session_txn TO authenticated;
GRANT ALL ON public.cash_session_txn TO service_role;
ALTER TABLE public.cash_session_txn ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_session_txn tenant read"  ON public.cash_session_txn FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "cash_session_txn tenant write" ON public.cash_session_txn FOR ALL    TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE INDEX IF NOT EXISTS ix_cash_session_txn_session ON public.cash_session_txn(session_id);

-- ─── 5. tax_invoice + line ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tax_invoice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_no TEXT,
  invoice_type public.tax_invoice_type NOT NULL,
  counterparty_type TEXT NOT NULL CHECK (counterparty_type IN ('payer','patient','direct')),
  counterparty_id UUID,
  claim_id UUID,
  cash_collection_id UUID REFERENCES public.cash_collection(id) ON DELETE SET NULL,
  parent_invoice_id UUID REFERENCES public.tax_invoice(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  gross_minor BIGINT NOT NULL DEFAULT 0,
  discount_minor BIGINT NOT NULL DEFAULT 0,
  taxable_base_minor BIGINT NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  vat_minor BIGINT NOT NULL DEFAULT 0,
  total_minor BIGINT NOT NULL DEFAULT 0,
  reporting_box public.tax_reporting_box NOT NULL,
  zatca_uuid UUID,
  zatca_hash TEXT,
  zatca_prev_hash TEXT,
  zatca_qr TEXT,
  zatca_signed_xml TEXT,
  zatca_status public.zatca_status NOT NULL DEFAULT 'pending',
  zatca_last_error TEXT,
  irn TEXT,
  issued_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_invoice TO authenticated;
GRANT ALL ON public.tax_invoice TO service_role;
ALTER TABLE public.tax_invoice ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_invoice tenant read"  ON public.tax_invoice FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tax_invoice tenant write" ON public.tax_invoice FOR ALL    TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE INDEX IF NOT EXISTS ix_tax_invoice_tenant ON public.tax_invoice(tenant_id, invoice_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_tax_invoice_zatca  ON public.tax_invoice(tenant_id, zatca_status);
CREATE INDEX IF NOT EXISTS ix_tax_invoice_claim  ON public.tax_invoice(claim_id);

CREATE TABLE IF NOT EXISTS public.tax_invoice_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL REFERENCES public.tax_invoice(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  service_code TEXT,
  qty NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price_minor BIGINT NOT NULL DEFAULT 0,
  discount_minor BIGINT NOT NULL DEFAULT 0,
  taxable_minor BIGINT NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (vat_rate IN (0.00, 15.00)),
  vat_minor BIGINT NOT NULL DEFAULT 0,
  reporting_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_invoice_line TO authenticated;
GRANT ALL ON public.tax_invoice_line TO service_role;
ALTER TABLE public.tax_invoice_line ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_invoice_line tenant read"  ON public.tax_invoice_line FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "tax_invoice_line tenant write" ON public.tax_invoice_line FOR ALL    TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE INDEX IF NOT EXISTS ix_tax_invoice_line_invoice ON public.tax_invoice_line(invoice_id);

-- ─── 6. interface_log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interface_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  interface_name TEXT NOT NULL,
  direction public.interface_direction NOT NULL,
  trigger TEXT,
  correlation_id TEXT,
  payload JSONB,
  response JSONB,
  status public.interface_msg_status NOT NULL DEFAULT 'queued',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  acked_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interface_log TO authenticated;
GRANT ALL ON public.interface_log TO service_role;
ALTER TABLE public.interface_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interface_log tenant read"  ON public.interface_log FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "interface_log tenant write" ON public.interface_log FOR ALL    TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE INDEX IF NOT EXISTS ix_interface_log_tenant ON public.interface_log(tenant_id, interface_name, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_interface_log_status ON public.interface_log(tenant_id, status);

-- ─── 7. event_posting_matrix (VAT box + GL config) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.event_posting_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  reporting_box public.tax_reporting_box,
  gl_account TEXT NOT NULL,
  vat_rate NUMERIC(5,2),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_type, reporting_box)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_posting_matrix TO authenticated;
GRANT ALL ON public.event_posting_matrix TO service_role;
ALTER TABLE public.event_posting_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_posting_matrix tenant read"  ON public.event_posting_matrix FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "event_posting_matrix tenant write" ON public.event_posting_matrix FOR ALL    TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ─── 8. interface_mapping ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interface_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  mapping_type public.mapping_type NOT NULL,
  source_code TEXT NOT NULL,
  target_code TEXT NOT NULL,
  payer_id UUID,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mapping_type, source_code, payer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interface_mapping TO authenticated;
GRANT ALL ON public.interface_mapping TO service_role;
ALTER TABLE public.interface_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interface_mapping tenant read"  ON public.interface_mapping FOR SELECT TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "interface_mapping tenant write" ON public.interface_mapping FOR ALL    TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id)) WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE INDEX IF NOT EXISTS ix_interface_mapping_tenant ON public.interface_mapping(tenant_id, mapping_type);

-- ─── 9. Additive columns on R6 tables ───────────────────────────────────────
ALTER TABLE public.refund_request      ADD COLUMN IF NOT EXISTS tax_credit_note_id UUID REFERENCES public.tax_invoice(id) ON DELETE SET NULL;
ALTER TABLE public.refund_request      ADD COLUMN IF NOT EXISTS vat_reversal_minor BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.deposit_transaction ADD COLUMN IF NOT EXISTS cash_collection_id UUID REFERENCES public.cash_collection(id) ON DELETE SET NULL;

-- ─── 10. Triggers ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_cash_session_touch      BEFORE UPDATE ON public.cash_session       FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cash_collection_touch   BEFORE UPDATE ON public.cash_collection    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tax_invoice_touch       BEFORE UPDATE ON public.tax_invoice        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_interface_log_touch     BEFORE UPDATE ON public.interface_log      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_event_posting_touch     BEFORE UPDATE ON public.event_posting_matrix FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_interface_mapping_touch BEFORE UPDATE ON public.interface_mapping  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-generate cash_collection.receipt_no + enqueue ERP posting on posted
CREATE OR REPLACE FUNCTION public.cash_collection_set_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.receipt_no IS NULL OR NEW.receipt_no = '' THEN
    NEW.receipt_no := 'RCP-' || to_char(now(),'YYYY') || '-' ||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_cash_collection_defaults
BEFORE INSERT ON public.cash_collection
FOR EACH ROW EXECUTE FUNCTION public.cash_collection_set_defaults();

CREATE OR REPLACE FUNCTION public.cash_collection_on_post()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'posted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'posted') THEN
    NEW.posted_at := COALESCE(NEW.posted_at, now());
    INSERT INTO public.erp_posting_queue (tenant_id, entity_type, entity_id, payload)
    VALUES (NEW.tenant_id, 'cash_collection', NEW.id,
            jsonb_build_object(
              'receipt_no', NEW.receipt_no,
              'method', NEW.method,
              'gross_minor', NEW.gross_minor,
              'net_collected_minor', NEW.net_collected_minor,
              'currency', NEW.currency,
              'claim_id', NEW.claim_id,
              'beneficiary_id', NEW.beneficiary_id
            ));
    IF NEW.session_id IS NOT NULL THEN
      INSERT INTO public.cash_session_txn (tenant_id, session_id, txn_kind, cash_collection_id, method, amount_minor, direction)
      VALUES (NEW.tenant_id, NEW.session_id, 'collection', NEW.id, NEW.method, NEW.net_collected_minor, 'in');
      UPDATE public.cash_session
         SET expected_minor = expected_minor + NEW.net_collected_minor
       WHERE id = NEW.session_id AND status = 'open';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_cash_collection_on_post
BEFORE INSERT OR UPDATE ON public.cash_collection
FOR EACH ROW EXECUTE FUNCTION public.cash_collection_on_post();

-- Cash session close: compute variance
CREATE OR REPLACE FUNCTION public.cash_session_on_close()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'closed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'closed') THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
    IF NEW.counted_minor IS NOT NULL THEN
      NEW.variance_minor := NEW.counted_minor - (COALESCE(NEW.expected_minor,0) + COALESCE(NEW.opening_float_minor,0));
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_cash_session_on_close
BEFORE INSERT OR UPDATE ON public.cash_session
FOR EACH ROW EXECUTE FUNCTION public.cash_session_on_close();

-- Interface log: stamp sent_at / acked_at
CREATE OR REPLACE FUNCTION public.interface_log_on_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'sent' AND NEW.sent_at IS NULL THEN
    NEW.sent_at := now();
  END IF;
  IF NEW.status = 'ack' AND NEW.acked_at IS NULL THEN
    NEW.acked_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_interface_log_on_status
BEFORE INSERT OR UPDATE ON public.interface_log
FOR EACH ROW EXECUTE FUNCTION public.interface_log_on_status();

-- Tax invoice: default invoice_no + issued_at
CREATE OR REPLACE FUNCTION public.tax_invoice_set_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.invoice_no IS NULL OR NEW.invoice_no = '' THEN
    NEW.invoice_no := CASE NEW.invoice_type
      WHEN 'b2b_insurance' THEN 'INV-B-'
      WHEN 'b2c_patient'   THEN 'INV-P-'
      WHEN 'direct_company' THEN 'INV-D-'
      WHEN 'credit_note'   THEN 'CN-T-'
      WHEN 'debit_note'    THEN 'DN-T-'
      ELSE 'INV-X-'
    END || to_char(now(),'YYYY') || '-' ||
      upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  END IF;
  IF NEW.issued_at IS NULL THEN NEW.issued_at := now(); END IF;
  IF NEW.zatca_uuid IS NULL THEN NEW.zatca_uuid := gen_random_uuid(); END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_tax_invoice_defaults
BEFORE INSERT ON public.tax_invoice
FOR EACH ROW EXECUTE FUNCTION public.tax_invoice_set_defaults();
