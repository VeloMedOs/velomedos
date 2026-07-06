
-- Helper: is caller a tenant admin/dispatcher for the given tenant?
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'superadmin')
    OR (
      public.is_tenant_member(_user_id, _tenant)
      AND (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'dispatcher'))
    )
$$;

-- care_plans
DROP POLICY IF EXISTS "homecare admins manage plans" ON public.care_plans;
CREATE POLICY "homecare admins manage plans" ON public.care_plans
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- care_recipients
DROP POLICY IF EXISTS "homecare admins manage recipients" ON public.care_recipients;
CREATE POLICY "homecare admins manage recipients" ON public.care_recipients
  FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- care_visit_vitals: derive tenant via care_visits
DROP POLICY IF EXISTS "admin reads visit vitals" ON public.care_visit_vitals;
CREATE POLICY "admin reads visit vitals" ON public.care_visit_vitals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_visits v
    WHERE v.id = care_visit_vitals.care_visit_id
      AND public.is_tenant_admin(auth.uid(), v.tenant_id)
  ));

-- medication_administrations: derive tenant via care_visits
DROP POLICY IF EXISTS "admin reads mar" ON public.medication_administrations;
CREATE POLICY "admin reads mar" ON public.medication_administrations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_visits v
    WHERE v.id = medication_administrations.care_visit_id
      AND public.is_tenant_admin(auth.uid(), v.tenant_id)
  ));

-- clinic_bookings: tenant via clinics
DROP POLICY IF EXISTS "bookings self" ON public.clinic_bookings;
CREATE POLICY "bookings self" ON public.clinic_bookings
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_bookings.clinic_id
        AND public.is_tenant_admin(auth.uid(), c.tenant_id)
    )
  );

DROP POLICY IF EXISTS "bookings self update" ON public.clinic_bookings;
CREATE POLICY "bookings self update" ON public.clinic_bookings
  FOR UPDATE TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_bookings.clinic_id
        AND public.is_tenant_admin(auth.uid(), c.tenant_id)
    )
  );

-- telehealth_sessions: tenant via booking → clinic
DROP POLICY IF EXISTS "th manage staff" ON public.telehealth_sessions;
CREATE POLICY "th manage staff" ON public.telehealth_sessions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinic_bookings b
    JOIN public.clinics c ON c.id = b.clinic_id
    WHERE b.id = telehealth_sessions.booking_id
      AND public.is_tenant_admin(auth.uid(), c.tenant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clinic_bookings b
    JOIN public.clinics c ON c.id = b.clinic_id
    WHERE b.id = telehealth_sessions.booking_id
      AND public.is_tenant_admin(auth.uid(), c.tenant_id)
  ));

-- credentials: staff creds scoped by shared tenant; ambulance creds superadmin-only
DROP POLICY IF EXISTS "credentials manage by staff" ON public.credentials;
CREATE POLICY "credentials manage by staff" ON public.credentials
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'superadmin')
    OR (
      subject_user_id IS NOT NULL
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
      AND EXISTS (
        SELECT 1
        FROM public.tenant_members me
        JOIN public.tenant_members them ON them.tenant_id = me.tenant_id
        WHERE me.user_id = auth.uid() AND them.user_id = credentials.subject_user_id
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'superadmin')
    OR (
      subject_user_id IS NOT NULL
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
      AND EXISTS (
        SELECT 1
        FROM public.tenant_members me
        JOIN public.tenant_members them ON them.tenant_id = me.tenant_id
        WHERE me.user_id = auth.uid() AND them.user_id = credentials.subject_user_id
      )
    )
  );

DROP POLICY IF EXISTS "credentials read self or staff" ON public.credentials;
CREATE POLICY "credentials read self or staff" ON public.credentials
  FOR SELECT TO authenticated
  USING (
    subject_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'superadmin')
    OR (
      subject_user_id IS NOT NULL
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
      AND EXISTS (
        SELECT 1
        FROM public.tenant_members me
        JOIN public.tenant_members them ON them.tenant_id = me.tenant_id
        WHERE me.user_id = auth.uid() AND them.user_id = credentials.subject_user_id
      )
    )
  );

-- screening_results: scope via corporate_account on the order
DROP POLICY IF EXISTS "results manage staff" ON public.screening_results;
CREATE POLICY "results manage staff" ON public.screening_results
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.screening_orders o
    LEFT JOIN public.corporate_accounts ca ON ca.id = o.corporate_account_id
    WHERE o.id = screening_results.order_id
      AND (
        public.has_role(auth.uid(), 'superadmin')
        OR ca.owner_user_id = auth.uid()
        OR public.is_tenant_admin(auth.uid(), o.corporate_account_id)
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.screening_orders o
    LEFT JOIN public.corporate_accounts ca ON ca.id = o.corporate_account_id
    WHERE o.id = screening_results.order_id
      AND (
        public.has_role(auth.uid(), 'superadmin')
        OR ca.owner_user_id = auth.uid()
        OR public.is_tenant_admin(auth.uid(), o.corporate_account_id)
      )
  ));
