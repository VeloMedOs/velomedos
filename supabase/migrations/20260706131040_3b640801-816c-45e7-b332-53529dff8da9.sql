
-- M16 — charge_is_billed() replace: only the _paid_minor reducer changes.
CREATE OR REPLACE FUNCTION public.charge_is_billed(_tbl text, _id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- D1 · Scoped refund re-lock via deposit lineage.
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

  -- D2 · Encounter-class branch.
  SELECT class INTO _class FROM public.encounter WHERE id = _charge.encounter_id;
  SELECT id, request_type INTO _adm_id, _adm_type
    FROM public.admission_request
   WHERE encounter_id = _charge.encounter_id
     AND status <> 'cancelled'
   ORDER BY created_at DESC LIMIT 1;

  IF _class = 'IMP' OR (_adm_id IS NOT NULL AND _adm_type = 'day_case') THEN
    IF _adm_id IS NULL THEN RETURN false; END IF;
    IF NOT public.admission_gate_open(_adm_id) THEN RETURN false; END IF;

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
    RETURN true;
  END IF;

  -- Insured path.
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

    -- D5 · Encounter-scoped cash reducer. The beneficiary_id branch (M07) is
    -- removed to prevent cross-encounter leaks. Voided rows already excluded
    -- by status = 'posted'.
    SELECT COALESCE(SUM(net_collected_minor), 0) INTO _paid_minor
      FROM public.cash_collection cc
     WHERE cc.tenant_id = _charge.tenant_id
       AND cc.status = 'posted'
       AND (cc.encounter_id = _charge.encounter_id
         OR cc.claim_id IN (SELECT c.id FROM public.claim c
                             WHERE c.encounter_id = _charge.encounter_id));

    SELECT COALESCE(SUM(net_minor), 0) INTO _committed
      FROM public.charge_item
     WHERE encounter_id = _charge.encounter_id
       AND pricing_mode = 'cash'
       AND status <> 'cancelled'
       AND (id = _charge.id OR status IN ('collected','in_progress','resulted','dispensed'));

    RETURN _committed <= _paid_minor + _wallet_balance;
  END IF;

  RETURN false;
END $function$;

-- M17 — Reseed referral rules per Addendum 1-A.
DELETE FROM public.pricing_rule WHERE tenant_id IS NULL AND scope = 'referral';

INSERT INTO public.pricing_rule (tenant_id, name, scope, priority, condition, action, active) VALUES
 (NULL,'Rule A Cross-specialty referral','referral',10,
  '{"target_specialty_differs":true}'::jsonb,
  '{"preauth_required":true,"charge_mode":"new_consult","code":"REF_NEW_CONSULT"}'::jsonb, true),
 (NULL,'Rule B Same-specialty follow-up','referral',20,
  '{"target_specialty_differs":false,"days_since_last_visit_max":14}'::jsonb,
  '{"preauth_required":false,"charge_mode":"follow_up","code":"REF_FOLLOW_UP"}'::jsonb, true),
 (NULL,'Rule C 14-day lapse / MRP shift','referral',30,
  '{"days_since_last_visit_min":15}'::jsonb,
  '{"charge_mode_resolver":"series_or_no_charge","series_specialties":["physio","rehab","dialysis"],"code":"REF_SERIES"}'::jsonb, true),
 (NULL,'Rule D Dental pre-save approval','referral',40,
  '{"category":"dental"}'::jsonb,
  '{"approval_before_save":true,"class_limit_check":"policy.dental_visits","recheck_if_bill_after_visit":true,"code":"REF_DENTAL"}'::jsonb, true),
 (NULL,'Rule E Over-booking guard','referral',50,
  '{"overbook":true}'::jsonb,
  '{"alert_only":true,"hard_cap_key":"overbook_limit","code":"REF_OVERBOOK"}'::jsonb, true)
ON CONFLICT DO NOTHING;
