-- M-S4T1-01 · service_master.execution_venue hardening (column exists; backfill + CHECK)
UPDATE public.service_master SET execution_venue = 'clinic' WHERE execution_venue IS NULL;
ALTER TABLE public.service_master ALTER COLUMN execution_venue SET NOT NULL;
ALTER TABLE public.service_master
  ADD CONSTRAINT service_master_execution_venue_check
  CHECK (execution_venue IN ('treatment_room','imaging','lab','pharmacy','bedside','clinic'));

-- Seed treatment_room on well-known internal_codes if present (symbolic; no-op otherwise).
UPDATE public.service_master
   SET execution_venue = 'treatment_room'
 WHERE execution_venue = 'clinic'
   AND internal_code IN ('IUD_INSERT','IUD_REMOVE','IRON_INFUSION','CAST_REMOVAL','WOUND_DRESSING','NEBULIZER');

-- M-S4T1-02 · cashier_assignment (E14 stub — table only, no UI this turn)
CREATE TABLE IF NOT EXISTS public.cashier_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cashier_assignment_active_idx
  ON public.cashier_assignment(tenant_id, user_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS cashier_assignment_encounter_idx
  ON public.cashier_assignment(tenant_id, encounter_id);

GRANT SELECT, INSERT, UPDATE ON public.cashier_assignment TO authenticated;
GRANT ALL ON public.cashier_assignment TO service_role;

ALTER TABLE public.cashier_assignment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashier_assignment tenant read"
  ON public.cashier_assignment FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "cashier_assignment cashier write"
  ON public.cashier_assignment FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND (public.has_role(auth.uid(), 'superadmin')
         OR EXISTS (SELECT 1 FROM public.tenant_members tm
                     WHERE tm.user_id = auth.uid() AND tm.tenant_id = cashier_assignment.tenant_id
                       AND tm.clinical_role IN ('cashier','tenant_admin','front_office')))
  );

CREATE POLICY "cashier_assignment tenant update"
  ON public.cashier_assignment FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER cashier_assignment_touch_updated_at
  BEFORE UPDATE ON public.cashier_assignment
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- M-S4T1-03 · queue_occupancy (JJ5 — keyed by clinic; token table pending debt #14)
CREATE TABLE IF NOT EXISTS public.queue_occupancy (
  tenant_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  specialty text,
  registered int NOT NULL DEFAULT 0,
  in_progress int NOT NULL DEFAULT 0,
  waiting int NOT NULL DEFAULT 0,
  load_band text NOT NULL DEFAULT 'green' CHECK (load_band IN ('green','amber','red')),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, clinic_id)
);
COMMENT ON TABLE public.queue_occupancy IS
  'HCA queue load band per clinic. TODO(debt #14): re-key by queue_id when the QMS token/queue tables land.';

GRANT SELECT ON public.queue_occupancy TO authenticated;
GRANT ALL ON public.queue_occupancy TO service_role;

ALTER TABLE public.queue_occupancy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_occupancy tenant read"
  ON public.queue_occupancy FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE OR REPLACE FUNCTION public.refresh_queue_occupancy(_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.queue_occupancy WHERE tenant_id = _tenant;
  INSERT INTO public.queue_occupancy (tenant_id, clinic_id, specialty, registered, in_progress, waiting, load_band, refreshed_at)
  SELECT
    _tenant AS tenant_id,
    cb.clinic_id,
    NULL::text AS specialty,
    COUNT(*) FILTER (WHERE cb.status IN ('requested','confirmed')) AS registered,
    COUNT(*) FILTER (WHERE cb.status = 'in_consult') AS in_progress,
    COUNT(*) FILTER (WHERE cb.status = 'arrived') AS waiting,
    CASE
      WHEN COUNT(*) FILTER (WHERE cb.status = 'arrived') >= 20 THEN 'red'
      WHEN COUNT(*) FILTER (WHERE cb.status = 'arrived') >= 10 THEN 'amber'
      ELSE 'green'
    END AS load_band,
    now()
  FROM public.clinic_bookings cb
  WHERE cb.tenant_id = _tenant
    AND cb.slot_at::date = CURRENT_DATE
    AND cb.status IN ('requested','confirmed','arrived','in_consult')
  GROUP BY cb.clinic_id;
END $$;

REVOKE ALL ON FUNCTION public.refresh_queue_occupancy(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.refresh_queue_occupancy(uuid) TO authenticated, service_role;

-- M-S4T1-04 · index for origin_encounter_id lookups
CREATE INDEX IF NOT EXISTS clinic_bookings_origin_enc_idx
  ON public.clinic_bookings(tenant_id, origin_encounter_id)
  WHERE origin_encounter_id IS NOT NULL;