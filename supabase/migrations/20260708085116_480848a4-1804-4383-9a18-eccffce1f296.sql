ALTER TABLE public.clinic_bookings
  ADD COLUMN IF NOT EXISTS rebook_request boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS charge_mode    public.charge_mode NULL;

COMMENT ON COLUMN public.clinic_bookings.charge_mode IS
  'DISPLAY-only Rules B/C outcome from evaluateTriggers (HCA-0526/0198/0807). Never blocks the drop.';

-- Extend clinic_bookings_status_guard: stamp cancelled_at on transition to 'cancelled'.
CREATE OR REPLACE FUNCTION public.clinic_bookings_status_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  -- Confirmed transition: block if eligibility still pending
  IF _to = 'confirmed' AND NEW.confirmed_at IS NULL THEN
    IF NEW.eligibility_check_pending = true THEN
      RAISE EXCEPTION 'clinic_bookings: cannot confirm while eligibility_check_pending'
        USING ERRCODE = 'P0001';
    END IF;
    NEW.confirmed_at := now();
  END IF;

  -- No-show sync
  IF _to = 'no_show' THEN
    NEW.no_show := true;
  END IF;

  -- M-S3T2-03: cancel stamp
  IF _to = 'cancelled' AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at := now();
  END IF;

  RETURN NEW;
END $function$;