
-- M15 · Fix M07 gate predicate defects (D1..D4) + supporting scaffolding.

-- ── Prerequisite column for D3 deposit-adequacy formula ────────────────────
ALTER TABLE public.admission_request
  ADD COLUMN IF NOT EXISTS estimated_charges_minor bigint NULL;

-- ── Helper: resolve preauth_required at the order-item level ──────────────
-- Order-item tables carry their catalog reference via order_id → parent order,
-- whose `preauth_required` was resolved at ordering time (payer-specific).
CREATE OR REPLACE FUNCTION public._order_item_preauth_required(_tbl text, _id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE _flag boolean := false;
BEGIN
  IF _tbl = 'lab_order_item' THEN
    SELECT lo.preauth_required INTO _flag
      FROM public.lab_order_item i JOIN public.lab_order lo ON lo.id = i.order_id
     WHERE i.id = _id;
  ELSIF _tbl = 'radiology_order_item' THEN
    SELECT ro.preauth_required INTO _flag
      FROM public.radiology_order_item i JOIN public.radiology_order ro ON ro.id = i.order_id
     WHERE i.id = _id;
  ELSIF _tbl = 'service_order_item' THEN
    SELECT so.preauth_required INTO _flag
      FROM public.service_order_item i JOIN public.service_order so ON so.id = i.order_id
     WHERE i.id = _id;
  ELSIF _tbl = 'ep_order_item' THEN
    SELECT eo.preauth_required INTO _flag
      FROM public.ep_order_item i JOIN public.electrophysiology_order eo ON eo.id = i.order_id
     WHERE i.id = _id;
  ELSIF _tbl = 'prescription_item' THEN
    SELECT p.preauth_required INTO _flag
      FROM public.prescription_item i JOIN public.prescription p ON p.id = i.order_id
     WHERE i.id = _id;
  END IF;
  RETURN COALESCE(_flag, false);
END $$;

REVOKE ALL ON FUNCTION public._order_item_preauth_required(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._order_item_preauth_required(text, uuid) TO authenticated, service_role;

-- ── D3: rewrite admission_gate_open() with the full locked rule ───────────
CREATE OR REPLACE FUNCTION public.admission_gate_open(_admission_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _adm RECORD;
  _has_release boolean := false;
  _pct int;
  _required bigint;
BEGIN
  SELECT * INTO _adm FROM public.admission_request WHERE id = _admission_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Releasing exceptions still short-circuit true.
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

  -- Insured admissions: require an approved authorization on this encounter.
  IF _adm.coverage_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.authorization_request ar
        JOIN public.authorization_item ai ON ai.authorization_request_id = ar.id
       WHERE ar.encounter_id = _adm.encounter_id
         AND ai.decision IN ('approved','partial')
    ) THEN RETURN false; END IF;
  END IF;

  -- Deposit adequacy — config-driven. The only permitted literal `35` is the
  -- default argument to the getter; never a formula constant.
  _pct := ((public.rcm_admin_config_get(_adm.tenant_id, 'ip_deposit_min_percent', to_jsonb(35))) #>> '{}')::int;
  _required := GREATEST(
    COALESCE(_adm.requested_deposit_minor, 0),
    (COALESCE(_adm.estimated_charges_minor, 0) * _pct / 100)
  );
  RETURN COALESCE(_adm.paid_amount_minor, 0) >= _required;
END $$;

-- ── D1+D2+D4: rewrite charge_is_billed() ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.charge_is_billed(_tbl text, _id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _charge RECORD;
  _has_release boolean := false;
  _class text;
  _adm_id uuid;
  _adm_type public.ip_request_type;
  _wallet_balance bigint := 0;
  _paid_minor bigint := 0;
  _committed bigint := 0;
  _needs_auth boolean := false;
BEGIN
  SELECT * INTO _charge FROM public.charge_item
   WHERE order_item_table = _tbl AND order_item_id = _id LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF _charge.status = 'cancelled' THEN RETURN false; END IF;

  -- Releasing exceptions (charge- or encounter-scoped) short-circuit true.
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
  ) INTO _has_release;
  IF _has_release THEN RETURN true; END IF;

  -- D1 · Scoped refund re-lock via deposit lineage (only linkage refund_request has).
  IF EXISTS (
    SELECT 1
      FROM public.refund_request r
      JOIN public.deposit d ON d.id = r.deposit_id
     WHERE r.tenant_id = _charge.tenant_id
       AND r.status IN ('approved','executed')
       AND (
         d.encounter_id = _charge.encounter_id
         OR d.admission_request_id IN (
              SELECT ar.id FROM public.admission_request ar
               WHERE ar.encounter_id = _charge.encounter_id)
       )
  ) THEN
    RETURN false;
  END IF;

  -- D2 · Encounter-class branch: IP or day-case admission → admission gate governs.
  SELECT class INTO _class FROM public.encounter WHERE id = _charge.encounter_id;
  SELECT id, request_type INTO _adm_id, _adm_type
    FROM public.admission_request
   WHERE encounter_id = _charge.encounter_id
     AND status <> 'cancelled'
   ORDER BY created_at DESC LIMIT 1;

  IF _class = 'IMP' OR (_adm_id IS NOT NULL AND _adm_type = 'day_case') THEN
    IF _adm_id IS NULL THEN RETURN false; END IF;
    IF NOT public.admission_gate_open(_adm_id) THEN RETURN false; END IF;

    -- Per-order auth only when preauth is required for this item.
    _needs_auth :=
      public._order_item_preauth_required(_tbl, _id)
      OR (_charge.service_id IS NOT NULL AND
          COALESCE((SELECT preauth_required FROM public.service_master WHERE id = _charge.service_id), false))
      OR (_charge.drug_id IS NOT NULL AND
          COALESCE((SELECT preauth_required FROM public.drug_master    WHERE id = _charge.drug_id), false));

    IF _needs_auth THEN
      RETURN EXISTS (
        SELECT 1 FROM public.authorization_item ai
         WHERE ai.charge_item_id = _charge.id AND ai.decision IN ('approved','partial')
      );
    END IF;
    RETURN true;  -- drg_bundled included; admission gate governs
  END IF;

  -- AMB / EMER / HH / VR fall through to per-order branches.

  -- Insured: any approved covering authorization on this charge.
  IF _charge.pricing_mode = 'insured' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.authorization_item ai
       WHERE ai.charge_item_id = _charge.id
         AND ai.decision IN ('approved','partial')
    );
  END IF;

  -- Self-pay cash path.
  IF _charge.pricing_mode = 'cash' THEN
    SELECT COALESCE(pw.balance_minor, 0) INTO _wallet_balance
      FROM public.encounter e2
      LEFT JOIN public.patient_wallet pw
        ON pw.tenant_id = _charge.tenant_id AND pw.beneficiary_id = e2.beneficiary_id
     WHERE e2.id = _charge.encounter_id;
    IF _wallet_balance < 0 THEN RETURN false; END IF;

    -- Cumulative payments for this encounter (posted cash only — voided auto-excluded).
    SELECT COALESCE(SUM(net_collected_minor), 0) INTO _paid_minor
      FROM public.cash_collection
     WHERE tenant_id = _charge.tenant_id
       AND status = 'posted'
       AND (claim_id IN (SELECT c.id FROM public.claim c WHERE c.encounter_id = _charge.encounter_id)
         OR beneficiary_id = (SELECT e.beneficiary_id FROM public.encounter e WHERE e.id = _charge.encounter_id));

    -- D4 · Cumulative committed cash charges on this encounter — this charge +
    -- any cash charge already past the gate.
    SELECT COALESCE(SUM(net_minor), 0) INTO _committed
      FROM public.charge_item
     WHERE encounter_id = _charge.encounter_id
       AND pricing_mode = 'cash'
       AND status <> 'cancelled'
       AND (id = _charge.id OR status IN ('collected','in_progress','resulted','dispensed'));

    RETURN _committed <= _paid_minor + _wallet_balance;
  END IF;

  RETURN false;
END $$;

-- ── v_order_item_gate: exclude cancelled rows entirely ───────────────────
CREATE OR REPLACE VIEW public.v_order_item_gate
WITH (security_invoker = true) AS
WITH items AS (
  SELECT 'lab_order_item'::text AS order_item_table, i.id AS order_item_id, i.tenant_id
    FROM public.lab_order_item i WHERE i.status <> 'cancelled'
  UNION ALL
  SELECT 'radiology_order_item', i.id, i.tenant_id
    FROM public.radiology_order_item i WHERE i.status <> 'cancelled'
  UNION ALL
  SELECT 'service_order_item', i.id, i.tenant_id
    FROM public.service_order_item i WHERE i.status <> 'cancelled'
  UNION ALL
  SELECT 'ep_order_item', i.id, i.tenant_id
    FROM public.ep_order_item i WHERE i.status <> 'cancelled'
  UNION ALL
  SELECT 'prescription_item', i.id, i.tenant_id
    FROM public.prescription_item i
   WHERE COALESCE(i.dispense_status, 'ordered') <> 'cancelled'
)
SELECT
  i.order_item_table,
  i.order_item_id,
  i.tenant_id,
  ci.id AS charge_item_id,
  ci.encounter_id,
  ci.pricing_mode,
  ci.net_minor,
  CASE
    WHEN public.charge_is_billed(i.order_item_table, i.order_item_id) THEN
      CASE WHEN EXISTS (
        SELECT 1 FROM public.rcm_gate_exception e
         WHERE (e.charge_item_id = ci.id OR e.encounter_id = ci.encounter_id)
           AND e.closed_at IS NULL
           AND (e.expires_at IS NULL OR e.expires_at > now())
      ) THEN 'released_by_exception'::public.rcm_gate_state
      ELSE 'billed'::public.rcm_gate_state
      END
    ELSE 'locked'::public.rcm_gate_state
  END AS gate_state,
  (SELECT e.id FROM public.rcm_gate_exception e
    WHERE (e.charge_item_id = ci.id OR e.encounter_id = ci.encounter_id)
      AND e.closed_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())
    ORDER BY e.created_at DESC LIMIT 1) AS exception_id,
  (SELECT e.reason_code FROM public.rcm_gate_exception e
    WHERE (e.charge_item_id = ci.id OR e.encounter_id = ci.encounter_id)
      AND e.closed_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())
    ORDER BY e.created_at DESC LIMIT 1) AS reason_code
FROM items i
LEFT JOIN public.charge_item ci
  ON ci.order_item_table = i.order_item_table AND ci.order_item_id = i.order_item_id;
