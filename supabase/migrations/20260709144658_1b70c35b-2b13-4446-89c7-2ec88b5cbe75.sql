-- M-S4T2-00 · service_master.billing_type
ALTER TABLE public.service_master
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'on_raising';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_master_billing_type_check') THEN
    ALTER TABLE public.service_master
      ADD CONSTRAINT service_master_billing_type_check
      CHECK (billing_type IN ('on_raising','on_execution','no_charge'));
  END IF;
END $$;

-- M-S4T2-02 · wallet_gate_open
CREATE OR REPLACE FUNCTION public.wallet_gate_open(_beneficiary_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT balance_minor >= 0 FROM public.patient_wallet
      WHERE beneficiary_id = _beneficiary_id AND tenant_id = _tenant_id LIMIT 1),
    true);
$$;
REVOKE ALL ON FUNCTION public.wallet_gate_open(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.wallet_gate_open(uuid, uuid) TO authenticated, service_role;

-- M-S4T2-01 · v_cashier_worklist
DROP VIEW IF EXISTS public.v_cashier_worklist CASCADE;
CREATE VIEW public.v_cashier_worklist WITH (security_invoker=true) AS
  WITH per_enc AS (
    SELECT ci.tenant_id, ci.encounter_id,
      SUM(COALESCE(ci.net_minor,0))::bigint AS total_minor,
      SUM(COALESCE(ci.patient_share_minor,0))::bigint AS patient_share_minor,
      SUM(COALESCE(ci.payer_share_minor,0))::bigint AS payer_share_minor,
      COUNT(*) FILTER (WHERE ci.status = 'ordered')::int AS ordered_items
    FROM public.charge_item ci
    WHERE ci.status <> 'cancelled'
    GROUP BY ci.tenant_id, ci.encounter_id
  ),
  auth_totals AS (
    SELECT ai.tenant_id, ci.encounter_id,
      SUM(COALESCE(ai.benefit_amount_minor,0))
        FILTER (WHERE ai.decision IN ('approved','partial'))::bigint AS approved_minor
    FROM public.authorization_item ai
    JOIN public.charge_item ci ON ci.id = ai.charge_item_id
    GROUP BY ai.tenant_id, ci.encounter_id
  ),
  claim_open AS (
    SELECT tenant_id, encounter_id, bool_or(status NOT IN ('paid','denied','closed')) AS has_open_claim
      FROM public.claim GROUP BY tenant_id, encounter_id
  )
  SELECT e.tenant_id, e.id AS encounter_id, e.encounter_number, e.beneficiary_id,
    e.journey_state, e.class AS encounter_class, e.coverage_id,
    p.total_minor, p.patient_share_minor, p.payer_share_minor, p.ordered_items,
    COALESCE(a.approved_minor, 0) AS approved_minor,
    GREATEST(COALESCE(p.patient_share_minor,0), 0) AS outstanding_minor,
    COALESCE(c.has_open_claim, false) AS has_open_claim
  FROM public.encounter e
  JOIN per_enc p ON p.tenant_id = e.tenant_id AND p.encounter_id = e.id
  LEFT JOIN auth_totals a ON a.tenant_id = e.tenant_id AND a.encounter_id = e.id
  LEFT JOIN claim_open  c ON c.tenant_id = e.tenant_id AND c.encounter_id = e.id
  WHERE e.class = 'AMB' AND e.journey_state NOT IN ('void');
GRANT SELECT ON public.v_cashier_worklist TO authenticated, service_role;

-- M-S4T2-03 · statement-level occupancy refresh triggers (KK5)
CREATE OR REPLACE FUNCTION public.tg_refresh_queue_occupancy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _t uuid;
BEGIN
  FOR _t IN SELECT DISTINCT tenant_id FROM new_table WHERE tenant_id IS NOT NULL
  LOOP PERFORM public.refresh_queue_occupancy(_t); END LOOP;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS clinic_bookings_occupancy_refresh_ins ON public.clinic_bookings;
CREATE TRIGGER clinic_bookings_occupancy_refresh_ins
  AFTER INSERT ON public.clinic_bookings
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_refresh_queue_occupancy();

DROP TRIGGER IF EXISTS clinic_bookings_occupancy_refresh_upd ON public.clinic_bookings;
CREATE TRIGGER clinic_bookings_occupancy_refresh_upd
  AFTER UPDATE ON public.clinic_bookings
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_refresh_queue_occupancy();

DROP TRIGGER IF EXISTS encounter_occupancy_refresh_ins ON public.encounter;
CREATE TRIGGER encounter_occupancy_refresh_ins
  AFTER INSERT ON public.encounter
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_refresh_queue_occupancy();

DROP TRIGGER IF EXISTS encounter_occupancy_refresh_upd ON public.encounter;
CREATE TRIGGER encounter_occupancy_refresh_upd
  AFTER UPDATE ON public.encounter
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_refresh_queue_occupancy();