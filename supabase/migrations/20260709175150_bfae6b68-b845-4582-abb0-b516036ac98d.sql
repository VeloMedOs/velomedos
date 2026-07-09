
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

  INSERT INTO public.clinic_schedule
    (tenant_id, clinic_id, specialty, weekday, start_time, end_time, slot_duration_min, status)
  SELECT _tenant, _clinic_id, 'vaccination', dow::smallint,
         '09:00'::time, '17:00'::time, 15, 'open'
    FROM generate_series(1, 5) AS dow
   WHERE NOT EXISTS (
     SELECT 1 FROM public.clinic_schedule s WHERE s.clinic_id = _clinic_id
   );

  RETURN _clinic_id;
END $$;
