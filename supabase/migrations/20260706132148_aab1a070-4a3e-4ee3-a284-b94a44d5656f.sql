DROP POLICY IF EXISTS "owner reads insurance" ON public.patient_insurance;
CREATE POLICY "owner reads insurance" ON public.patient_insurance
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);