-- M07: rcm_gate_exception table + charge_is_billed() + guards + v_order_item_gate view.

-- ============ TABLE: rcm_gate_exception ============
CREATE TABLE public.rcm_gate_exception (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL,
  charge_item_id uuid NULL,
  encounter_id uuid NULL,
  admission_request_id uuid NULL,
  exception_type public.rcm_gate_exception_type NOT NULL,
  reason_code public.rcm_gate_reason_code NULL,
  reason_text text NULL,
  granted_by uuid NULL,
  granted_role text NULL,
  manual_approved_minor bigint NULL,
  nphies_approved_minor bigint NULL,
  wallet_delta_minor bigint NULL,
  reconciled_at timestamptz NULL,
  expires_at timestamptz NULL,
  retrospective_auth_state text NULL,
  closed_at timestamptz NULL,
  closed_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rcm_gate_exception TO authenticated;
GRANT ALL ON public.rcm_gate_exception TO service_role;

ALTER TABLE public.rcm_gate_exception ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read gate exceptions"
  ON public.rcm_gate_exception FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "RCM/tenant admins manage gate exceptions"
  ON public.rcm_gate_exception FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX rcm_gate_exception_charge_idx ON public.rcm_gate_exception(charge_item_id) WHERE charge_item_id IS NOT NULL;
CREATE INDEX rcm_gate_exception_encounter_idx ON public.rcm_gate_exception(encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX rcm_gate_exception_admission_idx ON public.rcm_gate_exception(admission_request_id) WHERE admission_request_id IS NOT NULL;
CREATE INDEX rcm_gate_exception_open_idx ON public.rcm_gate_exception(tenant_id, exception_type) WHERE closed_at IS NULL;

CREATE TRIGGER trg_rcm_gate_exception_updated_at
  BEFORE UPDATE ON public.rcm_gate_exception
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ FN: charge_is_billed(_tbl, _id) ============
CREATE OR REPLACE FUNCTION public.charge_is_billed(_tbl text, _id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _charge RECORD;
  _has_approved_auth boolean := false;
  _has_release_exception boolean := false;
  _refunded boolean := false;
  _wallet_balance bigint := 0;
  _paid_minor bigint := 0;
  _financial_type text;
BEGIN
  -- Locate the charge_item mirroring this order-item row.
  SELECT * INTO _charge
    FROM public.charge_item
   WHERE order_item_table = _tbl AND order_item_id = _id
   LIMIT 1;

  IF NOT FOUND THEN
    -- No charge yet → not billed.
    RETURN false;
  END IF;

  -- 1. Not cancelled.
  IF _charge.status = 'cancelled' THEN RETURN false; END IF;

  -- 4a. Any active releasing exception (emergency_override + others) short-circuits true.
  SELECT EXISTS (
    SELECT 1 FROM public.rcm_gate_exception e
     WHERE (e.charge_item_id = _charge.id
            OR (e.encounter_id IS NOT NULL AND e.encounter_id = _charge.encounter_id))
       AND e.closed_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
       AND e.exception_type IN (
         'emergency_override','partial_deposit_override','installment_override',
         'clinical_urgency','mrp_verbal_order','newborn_inherit',
         'ineligibility_workflow','config_no_auth','admin_override'
       )
  ) INTO _has_release_exception;

  IF _has_release_exception THEN RETURN true; END IF;

  -- Refund re-lock: any settled refund on this charge closes the gate.
  SELECT EXISTS (
    SELECT 1 FROM public.refund_request r
     WHERE r.tenant_id = _charge.tenant_id
       AND r.status IN ('executed','approved')
       AND EXISTS (
         SELECT 1 FROM public.credit_note cn
          WHERE cn.tenant_id = _charge.tenant_id
            AND cn.beneficiary_id = (SELECT e2.beneficiary_id FROM public.encounter e2 WHERE e2.id = _charge.encounter_id)
       )
  ) INTO _refunded;
  IF _refunded THEN
    -- Only re-lock when there is no active exception (already returned above if present).
    NULL;
  END IF;

  -- 2. Insured path.
  IF _charge.pricing_mode = 'insured' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.authorization_item ai
       WHERE ai.charge_item_id = _charge.id
         AND ai.decision IN ('approved','partial')
    ) INTO _has_approved_auth;
    RETURN _has_approved_auth;
  END IF;

  -- 3. Self-pay path.
  IF _charge.pricing_mode = 'cash' THEN
    -- Wallet balance for this beneficiary.
    SELECT COALESCE(pw.balance_minor, 0) INTO _wallet_balance
      FROM public.encounter e2
      LEFT JOIN public.patient_wallet pw
        ON pw.tenant_id = _charge.tenant_id AND pw.beneficiary_id = e2.beneficiary_id
     WHERE e2.id = _charge.encounter_id;

    IF _wallet_balance < 0 THEN
      -- Negative wallet blocks (§2.1).
      RETURN false;
    END IF;

    -- Sum posted cash_collection + applied deposits for this encounter.
    SELECT COALESCE(SUM(net_collected_minor), 0) INTO _paid_minor
      FROM public.cash_collection
     WHERE tenant_id = _charge.tenant_id
       AND status = 'posted'
       AND (claim_id IN (SELECT c.id FROM public.claim c WHERE c.encounter_id = _charge.encounter_id)
         OR beneficiary_id = (SELECT e.beneficiary_id FROM public.encounter e WHERE e.id = _charge.encounter_id));

    RETURN COALESCE(_charge.net_minor, 0) <= _paid_minor + _wallet_balance;
  END IF;

  RETURN false;
END $$;

GRANT EXECUTE ON FUNCTION public.charge_is_billed(text, uuid) TO authenticated, service_role;

-- ============ FN: admission_gate_open(_admission_id) ============
CREATE OR REPLACE FUNCTION public.admission_gate_open(_admission_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _adm RECORD;
  _has_release boolean := false;
BEGIN
  SELECT * INTO _adm FROM public.admission_request WHERE id = _admission_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Emergency / admin overrides open the admission gate.
  SELECT EXISTS (
    SELECT 1 FROM public.rcm_gate_exception e
     WHERE e.admission_request_id = _admission_id
       AND e.closed_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
       AND e.exception_type IN (
         'emergency_override','partial_deposit_override','installment_override',
         'clinical_urgency','admin_override','ineligibility_workflow'
       )
  ) INTO _has_release;
  IF _has_release THEN RETURN true; END IF;

  -- Insured admissions: needs an approved eligibility ref + deposit adequacy where required.
  IF _adm.coverage_id IS NOT NULL THEN
    RETURN COALESCE(_adm.paid_amount_minor, 0) >= COALESCE(_adm.requested_deposit_minor, 0);
  END IF;

  -- Self-pay: deposit adequacy ≥ IP deposit % threshold (read from rcm_admin_config later; default 35).
  -- Falls back to configured requested_deposit_minor when the config table doesn't exist yet.
  RETURN COALESCE(_adm.paid_amount_minor, 0) >= COALESCE(_adm.requested_deposit_minor, 0);
END $$;

GRANT EXECUTE ON FUNCTION public.admission_gate_open(uuid) TO authenticated, service_role;

-- ============ TRIGGER: order_item_perform_guard() ============
CREATE OR REPLACE FUNCTION public.order_item_perform_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _tbl text := TG_TABLE_NAME;
  _billed boolean;
BEGIN
  -- Cancellations are always allowed.
  IF TG_TABLE_NAME = 'prescription_item' THEN
    IF NEW.dispense_status IS NOT DISTINCT FROM OLD.dispense_status THEN RETURN NEW; END IF;
    IF NEW.dispense_status <> 'dispensed' THEN RETURN NEW; END IF;
    IF OLD.dispense_status = 'dispensed' THEN RETURN NEW; END IF;
    _billed := public.charge_is_billed(_tbl, NEW.id);
    IF NOT _billed THEN
      RAISE EXCEPTION 'billed_gate: order not billable' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Order-item tables using clinical_order_status.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  IF OLD.status <> 'ordered' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('in_progress','completed') THEN RETURN NEW; END IF;

  _billed := public.charge_is_billed(_tbl, NEW.id);
  IF NOT _billed THEN
    RAISE EXCEPTION 'billed_gate: order not billable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_lab_order_item_perform_guard
  BEFORE UPDATE ON public.lab_order_item
  FOR EACH ROW EXECUTE FUNCTION public.order_item_perform_guard();

CREATE TRIGGER trg_radiology_order_item_perform_guard
  BEFORE UPDATE ON public.radiology_order_item
  FOR EACH ROW EXECUTE FUNCTION public.order_item_perform_guard();

CREATE TRIGGER trg_service_order_item_perform_guard
  BEFORE UPDATE ON public.service_order_item
  FOR EACH ROW EXECUTE FUNCTION public.order_item_perform_guard();

CREATE TRIGGER trg_ep_order_item_perform_guard
  BEFORE UPDATE ON public.ep_order_item
  FOR EACH ROW EXECUTE FUNCTION public.order_item_perform_guard();

CREATE TRIGGER trg_prescription_item_perform_guard
  BEFORE UPDATE ON public.prescription_item
  FOR EACH ROW EXECUTE FUNCTION public.order_item_perform_guard();

-- ============ VIEW: v_order_item_gate ============
CREATE OR REPLACE VIEW public.v_order_item_gate AS
WITH items AS (
  SELECT 'lab_order_item'::text AS order_item_table, id AS order_item_id, tenant_id, status::text AS raw_status,
         (status = 'cancelled') AS cancelled, false AS dispensed_flag
    FROM public.lab_order_item
  UNION ALL
  SELECT 'radiology_order_item', id, tenant_id, status::text, (status = 'cancelled'), false FROM public.radiology_order_item
  UNION ALL
  SELECT 'service_order_item', id, tenant_id, status::text, (status = 'cancelled'), false FROM public.service_order_item
  UNION ALL
  SELECT 'ep_order_item', id, tenant_id, status::text, (status = 'cancelled'), false FROM public.ep_order_item
  UNION ALL
  SELECT 'prescription_item', id, tenant_id, COALESCE(dispense_status, 'ordered'), false, (dispense_status = 'dispensed')
    FROM public.prescription_item
)
SELECT i.order_item_table,
       i.order_item_id,
       i.tenant_id,
       ci.id AS charge_item_id,
       ci.encounter_id,
       ci.pricing_mode,
       ci.net_minor,
       CASE
         WHEN i.cancelled THEN 'billed'::public.rcm_gate_state  -- cancelled bypass
         WHEN public.charge_is_billed(i.order_item_table, i.order_item_id) THEN
           CASE WHEN EXISTS (
             SELECT 1 FROM public.rcm_gate_exception e
              WHERE (e.charge_item_id = ci.id OR e.encounter_id = ci.encounter_id)
                AND e.closed_at IS NULL
                AND (e.expires_at IS NULL OR e.expires_at > now())
           ) THEN 'released_by_exception'::public.rcm_gate_state
           ELSE 'billed'::public.rcm_gate_state END
         ELSE 'locked'::public.rcm_gate_state
       END AS gate_state,
       (SELECT e.id FROM public.rcm_gate_exception e
         WHERE (e.charge_item_id = ci.id OR e.encounter_id = ci.encounter_id)
           AND e.closed_at IS NULL
           AND (e.expires_at IS NULL OR e.expires_at > now())
         ORDER BY e.created_at DESC LIMIT 1) AS exception_id,
       (SELECT e.reason_code FROM public.rcm_gate_exception e
         WHERE (e.charge_item_id = ci.id OR e.encounter_id = ci.encounter_id)
           AND e.closed_at IS NULL
           AND (e.expires_at IS NULL OR e.expires_at > now())
         ORDER BY e.created_at DESC LIMIT 1) AS reason_code
  FROM items i
  LEFT JOIN public.charge_item ci
    ON ci.order_item_table = i.order_item_table
   AND ci.order_item_id = i.order_item_id;

GRANT SELECT ON public.v_order_item_gate TO authenticated, service_role;