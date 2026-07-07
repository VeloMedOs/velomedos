-- Step 3 Turn 1 Migration 2 · Scheduling tables + booking lifecycle + rule payload rewrite
-- Plan-time verified: clinic_bookings.status is bound to booking_status enum (AA1 short path).
-- Plan-time verified: no rows in service_master match physio/rehab/dialysis/therapy — Rule C
-- backfill is a documented no-op (Batch-C dependency).

-- =========================================================================
-- A · clinic_schedule
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.clinic_schedule (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  clinic_id             uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  provider_id           uuid,
  weekday               smallint,
  specific_date         date,
  start_time            time NOT NULL,
  end_time              time NOT NULL,
  slot_duration_min     integer NOT NULL DEFAULT 15,
  capacity_per_slot     integer NOT NULL DEFAULT 1,
  overbook_allowed      boolean NOT NULL DEFAULT false,
  overbook_limit        integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','modified','closed')),
  priority_rank         integer NOT NULL DEFAULT 100,
  allow_parallel_clinics boolean NOT NULL DEFAULT false,
  telemedicine_capable  boolean NOT NULL DEFAULT false,
  procedure_room        boolean NOT NULL DEFAULT false,
  wheelchair_access     boolean NOT NULL DEFAULT true,
  female_clinic         boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK ((weekday IS NULL) <> (specific_date IS NULL))
);
CREATE INDEX IF NOT EXISTS clinic_schedule_clinic_idx ON public.clinic_schedule (clinic_id, weekday, specific_date);
CREATE INDEX IF NOT EXISTS clinic_schedule_provider_idx ON public.clinic_schedule (provider_id, weekday, specific_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_schedule TO authenticated;
GRANT ALL ON public.clinic_schedule TO service_role;
ALTER TABLE public.clinic_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_schedule tenant read" ON public.clinic_schedule
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "clinic_schedule tenant write" ON public.clinic_schedule
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER tg_clinic_schedule_touch BEFORE UPDATE ON public.clinic_schedule
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- B · clinic_slot
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.clinic_slot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  schedule_id   uuid NOT NULL REFERENCES public.clinic_schedule(id) ON DELETE CASCADE,
  slot_at       timestamptz NOT NULL,
  capacity      integer NOT NULL DEFAULT 1,
  booked_count  integer NOT NULL DEFAULT 0,
  status        public.slot_status NOT NULL DEFAULT 'open',
  held_until    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, slot_at)
);
CREATE INDEX IF NOT EXISTS clinic_slot_at_idx ON public.clinic_slot (slot_at);
CREATE INDEX IF NOT EXISTS clinic_slot_status_idx ON public.clinic_slot (status) WHERE status IN ('open','held');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_slot TO authenticated;
GRANT ALL ON public.clinic_slot TO service_role;
ALTER TABLE public.clinic_slot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_slot tenant read" ON public.clinic_slot
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "clinic_slot tenant write" ON public.clinic_slot
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER tg_clinic_slot_touch BEFORE UPDATE ON public.clinic_slot
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================================
-- C · slot_block
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.slot_block (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  schedule_id           uuid REFERENCES public.clinic_schedule(id) ON DELETE CASCADE,
  slot_id               uuid REFERENCES public.clinic_slot(id) ON DELETE CASCADE,
  reason_code           text NOT NULL,
  note                  text,
  blocked_by            uuid,
  notify_stakeholders   boolean NOT NULL DEFAULT true,
  starts_at             timestamptz,
  ends_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK ((schedule_id IS NULL) <> (slot_id IS NULL))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_block TO authenticated;
GRANT ALL ON public.slot_block TO service_role;
ALTER TABLE public.slot_block ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slot_block tenant read" ON public.slot_block
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "slot_block tenant write" ON public.slot_block
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER tg_slot_block_touch BEFORE UPDATE ON public.slot_block
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reason validation against code_value / code_system(key='slot_block_reason').
CREATE OR REPLACE FUNCTION public.slot_block_validate_reason()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.code_value cv
      JOIN public.code_system cs ON cs.id = cv.code_system_id
     WHERE cs.key = 'slot_block_reason' AND cv.code = NEW.reason_code AND cv.active = true
  ) INTO _ok;
  IF NOT _ok THEN
    RAISE EXCEPTION 'slot_block: unknown reason_code %', NEW.reason_code USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER tg_slot_block_validate_reason
  BEFORE INSERT OR UPDATE OF reason_code ON public.slot_block
  FOR EACH ROW EXECUTE FUNCTION public.slot_block_validate_reason();

-- =========================================================================
-- D · booking_event (append-only audit log)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.booking_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid,
  booking_id  uuid NOT NULL REFERENCES public.clinic_bookings(id) ON DELETE CASCADE,
  event       text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now(),
  by_user     uuid,
  payload     jsonb
);
CREATE INDEX IF NOT EXISTS booking_event_booking_idx ON public.booking_event (booking_id, at);

GRANT SELECT, INSERT ON public.booking_event TO authenticated;
GRANT ALL ON public.booking_event TO service_role;
ALTER TABLE public.booking_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_event tenant read" ON public.booking_event
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'superadmin'));
-- INSERT only from triggers (SECURITY DEFINER emitter); no direct write policy.

-- =========================================================================
-- E · clinic_bookings extensions (idempotent)
-- =========================================================================
ALTER TABLE public.clinic_bookings
  ADD COLUMN IF NOT EXISTS provider_id                uuid,
  ADD COLUMN IF NOT EXISTS visit_type                 public.visit_type,
  ADD COLUMN IF NOT EXISTS slot_id                    uuid REFERENCES public.clinic_slot(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_target_id         uuid REFERENCES public.referral_target(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overbooked                 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at               timestamptz,
  ADD COLUMN IF NOT EXISTS no_show                    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS series_id                  uuid,
  ADD COLUMN IF NOT EXISTS eligibility_check_pending  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligibility_checked_at     timestamptz,
  ADD COLUMN IF NOT EXISTS eligibility_response       jsonb,
  ADD COLUMN IF NOT EXISTS tenant_id                  uuid REFERENCES public.corporate_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at                 timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS clinic_bookings_slot_idx    ON public.clinic_bookings (slot_id);
CREATE INDEX IF NOT EXISTS clinic_bookings_series_idx  ON public.clinic_bookings (series_id);
CREATE INDEX IF NOT EXISTS clinic_bookings_provider_idx ON public.clinic_bookings (provider_id, slot_at);
CREATE INDEX IF NOT EXISTS clinic_bookings_referral_target_idx ON public.clinic_bookings (referral_target_id);

-- =========================================================================
-- F · Lifecycle guard trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.clinic_bookings_status_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  _from public.booking_status;
  _to   public.booking_status;
  _ok   boolean := false;
BEGIN
  _from := OLD.status;
  _to   := NEW.status;
  IF _from = _to THEN RETURN NEW; END IF;

  -- Legal transitions
  IF _from = 'requested' AND _to IN ('confirmed','cancelled') THEN _ok := true;
  ELSIF _from = 'confirmed' AND _to IN ('arrived','no_show','cancelled') THEN _ok := true;
  ELSIF _from = 'arrived' AND _to IN ('in_consult','cancelled') THEN _ok := true;
  ELSIF _from = 'in_consult' AND _to = 'completed' THEN _ok := true;
  END IF;

  IF NOT _ok THEN
    RAISE EXCEPTION 'clinic_bookings: illegal status transition % -> %', _from, _to
      USING ERRCODE = 'P0001';
  END IF;

  -- BB3 · timestamp + no_show flag sync
  IF _to = 'confirmed' AND NEW.confirmed_at IS NULL THEN
    -- Confirmation requires eligibility check cleared
    IF NEW.eligibility_check_pending = true THEN
      RAISE EXCEPTION 'clinic_bookings: cannot confirm while eligibility_check_pending'
        USING ERRCODE = 'P0001';
    END IF;
    NEW.confirmed_at := now();
  END IF;
  IF _to = 'no_show' THEN
    NEW.no_show := true;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS tg_clinic_bookings_status_guard ON public.clinic_bookings;
CREATE TRIGGER tg_clinic_bookings_status_guard
  BEFORE UPDATE OF status ON public.clinic_bookings
  FOR EACH ROW EXECUTE FUNCTION public.clinic_bookings_status_guard();

-- =========================================================================
-- G · booking_event emitter (INSERT + status transitions)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.clinic_bookings_emit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_event (tenant_id, booking_id, event, by_user, payload)
    VALUES (NEW.tenant_id, NEW.id, 'created', auth.uid(),
            jsonb_build_object('status', NEW.status, 'slot_at', NEW.slot_at));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_event (tenant_id, booking_id, event, by_user, payload)
    VALUES (NEW.tenant_id, NEW.id, NEW.status::text, auth.uid(),
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS tg_clinic_bookings_emit_event ON public.clinic_bookings;
CREATE TRIGGER tg_clinic_bookings_emit_event
  AFTER INSERT OR UPDATE ON public.clinic_bookings
  FOR EACH ROW EXECUTE FUNCTION public.clinic_bookings_emit_event();

CREATE OR REPLACE FUNCTION public.clinic_bookings_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at := now(); RETURN NEW; END $fn$;
DROP TRIGGER IF EXISTS tg_clinic_bookings_touch ON public.clinic_bookings;
CREATE TRIGGER tg_clinic_bookings_touch BEFORE UPDATE ON public.clinic_bookings
  FOR EACH ROW EXECUTE FUNCTION public.clinic_bookings_touch();

-- =========================================================================
-- H · Held-slot lazy release helper (callable from routes / views)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.clinic_slot_release_expired_holds()
RETURNS integer LANGUAGE sql SET search_path = public AS $fn$
  WITH freed AS (
    UPDATE public.clinic_slot
       SET status = 'open', held_until = NULL
     WHERE status = 'held' AND held_until IS NOT NULL AND held_until < now()
    RETURNING id
  )
  SELECT COUNT(*)::int FROM freed;
$fn$;
GRANT EXECUTE ON FUNCTION public.clinic_slot_release_expired_holds() TO authenticated;

-- =========================================================================
-- I · slot_block_reason code system seed
-- =========================================================================
INSERT INTO public.code_system (key, name, kind, source_authority, is_current)
VALUES ('slot_block_reason', 'Slot Block Reasons', 'lov', 'VeloMed OS', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.code_value (code_system_id, code, display)
SELECT cs.id, v.code, v.display
  FROM public.code_system cs,
       (VALUES
         ('doctor_leave',    'Doctor on leave'),
         ('equipment_down',  'Equipment down'),
         ('or_case',         'Doctor in OR / Cath'),
         ('holiday',         'Public holiday'),
         ('ramadan_hours',   'Ramadan hours'),
         ('admin_hold',      'Administrative hold')
       ) AS v(code, display)
 WHERE cs.key = 'slot_block_reason'
ON CONFLICT (code_system_id, code) DO NOTHING;

-- =========================================================================
-- J · service_master series_therapy backfill (BB2 · V5)
-- =========================================================================
-- Plan-time verified: 0 rows match physio/rehab/dialysis/therapy service_types.
-- TODO Batch-C: service-catalog for series therapies not yet seeded; this
-- backfill is a documented no-op today. Rule C's sub_category='series_therapy'
-- flag will start firing once Batch-C lands the master rows.
UPDATE public.service_master
   SET sub_category = 'series_therapy'
 WHERE sub_category IS DISTINCT FROM 'series_therapy'
   AND service_type ILIKE ANY (ARRAY['%physio%','%rehab%','%dialysis%','%therapy%']);

-- =========================================================================
-- K · Referral rule payload rewrites (AA2 + BB1 + BB2)
-- =========================================================================
-- Rule B: {days_since_last_visit: {op:'lte', value:14}}
UPDATE public.pricing_rule
   SET condition = jsonb_build_object(
         'target_specialty_differs', false,
         'days_since_last_visit', jsonb_build_object('op','lte','value',14)
       )
 WHERE scope = 'referral' AND name = 'Rule B Same-specialty follow-up';

-- Rule C: {days_since_last_visit: {op:'gte', value:15}}
UPDATE public.pricing_rule
   SET condition = jsonb_build_object(
         'days_since_last_visit', jsonb_build_object('op','gte','value',15)
       ),
       action = jsonb_build_object(
         'code', 'REF_SERIES',
         'series_sub_category', 'series_therapy',
         'charge_mode_resolver', 'series_or_no_charge'
       )
 WHERE scope = 'referral' AND name = 'Rule C 14-day lapse / MRP shift';