
-- ============================================================
-- M-S4T3-01 — v_preauth_mid (no-PHI) + public accessor fn
-- ============================================================
CREATE OR REPLACE VIEW public.v_preauth_mid
WITH (security_invoker = true) AS
SELECT
  ar.id,
  ar.tenant_id,
  CASE
    WHEN ar.preauth_ref IS NULL THEN NULL
    ELSE '***-' || right(ar.preauth_ref, 3)
  END AS masked_ref,
  ar.status::text AS status,
  CASE ar.status::text
    WHEN 'new'                   THEN 'white'
    WHEN 'scrubbing'             THEN 'white'
    WHEN 'ready_to_submit'       THEN 'white'
    WHEN 'submitted'             THEN 'amber'
    WHEN 'queued_at_payer'       THEN 'amber'
    WHEN 'in_review'             THEN 'amber'
    WHEN 'more_info_requested'   THEN 'amber'
    WHEN 'approved'              THEN 'green'
    WHEN 'appeal_approved'       THEN 'green'
    WHEN 'partially_approved'    THEN 'teal'
    WHEN 'rejected'              THEN 'red'
    WHEN 'appeal_rejected'       THEN 'red'
    WHEN 'expired'               THEN 'red'
    ELSE 'white'
  END AS status_color,
  ar.decision_at,
  ar.valid_to,
  ar.priority,
  ar.updated_at
FROM public.authorization_request ar
WHERE ar.status::text NOT IN ('cancelled','converted_to_self_pay','closed','appealed');

GRANT SELECT ON public.v_preauth_mid TO authenticated;
GRANT ALL    ON public.v_preauth_mid TO service_role;

-- Public accessor: SECURITY DEFINER so anon kiosks can read without exposing base RLS.
-- Returns today's activity: rows updated today OR still non-terminal.
CREATE OR REPLACE FUNCTION public.preauth_mid_board(_tenant uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  masked_ref text,
  status text,
  status_color text,
  decision_at timestamptz,
  valid_to date,
  priority text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, tenant_id, masked_ref, status, status_color, decision_at, valid_to, priority, updated_at
    FROM public.v_preauth_mid
   WHERE tenant_id = _tenant
     AND (
       updated_at::date = current_date
       OR status IN ('new','scrubbing','ready_to_submit','submitted','queued_at_payer','in_review','more_info_requested','partially_approved')
     )
   ORDER BY updated_at DESC
   LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.preauth_mid_board(uuid) TO anon, authenticated, service_role;

-- ============================================================
-- M-S4T3-02 — v_treatment_room_worklist
-- ============================================================
CREATE OR REPLACE VIEW public.v_treatment_room_worklist
WITH (security_invoker = true) AS
SELECT
  g.order_item_table,
  g.order_item_id,
  g.charge_item_id,
  g.encounter_id,
  g.tenant_id,
  g.gate_state,
  g.reason_code,
  g.pricing_mode,
  g.net_minor,
  ci.created_at AS ordered_at,
  sm.id            AS service_id,
  sm.internal_code AS service_code,
  sm.name          AS service_name,
  sm.execution_venue
FROM public.v_order_item_gate g
JOIN public.charge_item ci    ON ci.id = g.charge_item_id
JOIN public.service_master sm ON sm.id = ci.service_id
                             AND sm.execution_venue = 'treatment_room'
WHERE g.order_item_table <> 'prescription_item';

GRANT SELECT ON public.v_treatment_room_worklist TO authenticated;
GRANT ALL    ON public.v_treatment_room_worklist TO service_role;

-- ============================================================
-- M-S4T3-03 — seed_vaccine_clinic (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_vaccine_clinic(_tenant uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clinic_id uuid;
BEGIN
  SELECT id INTO _clinic_id
    FROM public.clinics
   WHERE tenant_id = _tenant
     AND 'vaccination' = ANY (COALESCE(specialties, ARRAY[]::text[]))
   ORDER BY created_at NULLS LAST
   LIMIT 1;

  IF _clinic_id IS NOT NULL THEN
    RETURN _clinic_id;
  END IF;

  INSERT INTO public.clinics (tenant_id, name, specialties)
  VALUES (_tenant, 'Vaccine Clinic', ARRAY['vaccination']::text[])
  RETURNING id INTO _clinic_id;

  INSERT INTO public.clinic_schedule (tenant_id, clinic_id, specialty, day_of_week, start_time, end_time, slot_duration_minutes, active)
  SELECT _tenant, _clinic_id, 'vaccination', dow, '09:00'::time, '17:00'::time, 15, true
    FROM generate_series(1, 5) AS dow
   WHERE NOT EXISTS (
     SELECT 1 FROM public.clinic_schedule s WHERE s.clinic_id = _clinic_id
   );

  RETURN _clinic_id;
END $$;

GRANT EXECUTE ON FUNCTION public.seed_vaccine_clinic(uuid) TO authenticated, service_role;
