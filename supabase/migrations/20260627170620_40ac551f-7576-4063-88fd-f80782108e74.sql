
DROP POLICY IF EXISTS "defects read all auth" ON public.defects;
CREATE POLICY "defects staff or reporter read" ON public.defects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::app_role)
    OR reported_by = auth.uid()
  );

DROP POLICY IF EXISTS "wo read all auth" ON public.work_orders;
CREATE POLICY "wo staff read" ON public.work_orders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::app_role)
  );

DROP POLICY IF EXISTS "woi read all auth" ON public.work_order_items;
CREATE POLICY "woi staff read" ON public.work_order_items
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'dispatcher'::app_role)
  );

ALTER PUBLICATION supabase_realtime DROP TABLE public.incidents;

DROP POLICY IF EXISTS "anyone submit" ON public.business_requests;
CREATE POLICY "public submit business request" ON public.business_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    company_name IS NOT NULL AND length(company_name) BETWEEN 1 AND 200
    AND contact_name IS NOT NULL AND length(contact_name) BETWEEN 1 AND 200
    AND contact_email IS NOT NULL AND length(contact_email) BETWEEN 3 AND 320
    AND contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND status = 'new'
  );

DROP POLICY IF EXISTS "web_leads public insert" ON public.web_leads;
CREATE POLICY "public submit web lead" ON public.web_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(name) BETWEEN 1 AND 200
    AND kind = ANY (ARRAY['clinic','screening','rental','training','general'])
    AND status = 'new'
    AND (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
