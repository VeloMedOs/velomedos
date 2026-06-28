-- Tighten public exposure on ambulances and clinics tables.
-- Public endpoints continue to work via service-role reads and the clinics_public view.

DROP POLICY IF EXISTS "ambulances readable by all" ON public.ambulances;
CREATE POLICY "ambulances readable by authenticated"
  ON public.ambulances FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.ambulances FROM anon;

DROP POLICY IF EXISTS "clinics public read" ON public.clinics;
CREATE POLICY "clinics readable by authenticated"
  ON public.clinics FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.clinics FROM anon;

-- Ensure the safe public view remains anon-readable (excludes phone & sensitive cols)
GRANT SELECT ON public.clinics_public TO anon, authenticated;
