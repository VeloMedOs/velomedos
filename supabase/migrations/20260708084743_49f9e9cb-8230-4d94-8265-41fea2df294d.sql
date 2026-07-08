-- Add missing linkage columns.
ALTER TABLE public.clinic_bookings
  ADD COLUMN IF NOT EXISTS beneficiary_id uuid NULL REFERENCES public.beneficiary(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_id    uuid NULL REFERENCES public.clinic_schedule(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_id    uuid NULL REFERENCES public.coverage(id) ON DELETE SET NULL;

-- Backfill tenant_id via clinics (table is currently empty — no-op, safe).
UPDATE public.clinic_bookings cb
   SET tenant_id = c.tenant_id
  FROM public.clinics c
 WHERE c.id = cb.clinic_id AND cb.tenant_id IS NULL;

-- Enforce tenant_id NOT NULL now that all rows have it.
ALTER TABLE public.clinic_bookings ALTER COLUMN tenant_id SET NOT NULL;

-- Scheduler-driven bookings write beneficiary_id, not an auth.users patient_id.
ALTER TABLE public.clinic_bookings ALTER COLUMN patient_id DROP NOT NULL;

-- Index for tenant-scoped board reads.
CREATE INDEX IF NOT EXISTS clinic_bookings_tenant_idx ON public.clinic_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS clinic_bookings_schedule_idx ON public.clinic_bookings(schedule_id);

-- Rebuild RLS: drop user-scoped policies, create tenant-scoped policies.
DROP POLICY IF EXISTS "bookings self"        ON public.clinic_bookings;
DROP POLICY IF EXISTS "bookings self insert" ON public.clinic_bookings;
DROP POLICY IF EXISTS "bookings self update" ON public.clinic_bookings;

CREATE POLICY "bookings tenant read"   ON public.clinic_bookings FOR SELECT
  TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "bookings tenant insert" ON public.clinic_bookings FOR INSERT
  TO authenticated WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "bookings tenant update" ON public.clinic_bookings FOR UPDATE
  TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "bookings service" ON public.clinic_bookings FOR ALL
  TO service_role USING (true) WITH CHECK (true);