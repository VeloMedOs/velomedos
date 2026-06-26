
-- Telehealth scheduling support: distinguish telehealth bookings, link provider, allow patient self-create
ALTER TABLE public.clinic_bookings
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'in_person'
  CHECK (kind IN ('in_person','telehealth'));

ALTER TABLE public.telehealth_sessions
  ADD COLUMN IF NOT EXISTS provider_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_th_provider ON public.telehealth_sessions(provider_user_id);

-- Let patients create a telehealth session row for their own booking
DROP POLICY IF EXISTS "th patient self insert" ON public.telehealth_sessions;
CREATE POLICY "th patient self insert" ON public.telehealth_sessions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clinic_bookings b
    WHERE b.id = telehealth_sessions.booking_id AND b.patient_id = auth.uid()
  ));

-- Let patients cancel their own telehealth session row (status flip)
DROP POLICY IF EXISTS "th patient self update" ON public.telehealth_sessions;
CREATE POLICY "th patient self update" ON public.telehealth_sessions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinic_bookings b
    WHERE b.id = telehealth_sessions.booking_id AND b.patient_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clinic_bookings b
    WHERE b.id = telehealth_sessions.booking_id AND b.patient_id = auth.uid()
  ));
