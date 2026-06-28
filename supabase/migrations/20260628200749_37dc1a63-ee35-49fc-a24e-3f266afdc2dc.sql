
-- Wave 1: Operations Suite (Support + QA + Settings + Refunds)

-- 1) Refunds
CREATE TABLE public.ops_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.portal_payments(id) ON DELETE SET NULL,
  subscriber_id uuid,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','cancelled')),
  external_ref text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_refunds TO authenticated;
GRANT ALL ON public.ops_refunds TO service_role;
ALTER TABLE public.ops_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff full" ON public.ops_refunds FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));

-- 2) Reviews (patient post-trip rating)
CREATE TABLE public.ops_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.corporate_accounts(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','hidden','flagged')),
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_reviews TO authenticated;
GRANT ALL ON public.ops_reviews TO service_role;
ALTER TABLE public.ops_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient owns" ON public.ops_reviews FOR SELECT TO authenticated USING (patient_id = auth.uid());
CREATE POLICY "patient insert" ON public.ops_reviews FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid());
CREATE POLICY "portal staff all" ON public.ops_reviews FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));
CREATE POLICY "tenant member read" ON public.ops_reviews FOR SELECT TO authenticated USING (
  tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = ops_reviews.tenant_id AND tm.user_id = auth.uid())
);

-- 3) Chat filter rules
CREATE TABLE public.ops_chat_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  kind text NOT NULL DEFAULT 'profanity' CHECK (kind IN ('profanity','pii','spam','custom')),
  action text NOT NULL DEFAULT 'flag' CHECK (action IN ('flag','redact','block')),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_chat_filters TO authenticated;
GRANT ALL ON public.ops_chat_filters TO service_role;
ALTER TABLE public.ops_chat_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff" ON public.ops_chat_filters FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));
CREATE TRIGGER touch_chat_filters BEFORE UPDATE ON public.ops_chat_filters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Notifications (broadcast + per-audience)
CREATE TABLE public.ops_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','critical')),
  audience text NOT NULL CHECK (audience IN ('superadmin','tenant','patient','provider','all','user')),
  audience_tenant_id uuid REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  audience_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  link_to text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_notifications TO authenticated;
GRANT ALL ON public.ops_notifications TO service_role;
ALTER TABLE public.ops_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff all" ON public.ops_notifications FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));
CREATE POLICY "user reads relevant" ON public.ops_notifications FOR SELECT TO authenticated USING (
  audience = 'all'
  OR (audience = 'user' AND audience_user_id = auth.uid())
  OR (audience = 'tenant' AND audience_tenant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.tenant_id = ops_notifications.audience_tenant_id AND tm.user_id = auth.uid()))
  OR (audience = 'patient' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'patient'))
  OR (audience = 'provider' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('paramedic','driver')))
  OR (audience = 'superadmin' AND public.is_portal_staff(auth.uid()))
);
CREATE INDEX idx_ops_notifications_audience ON public.ops_notifications(audience, audience_tenant_id, audience_user_id);

CREATE TABLE public.ops_notification_reads (
  notification_id uuid NOT NULL REFERENCES public.ops_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.ops_notification_reads TO authenticated;
GRANT ALL ON public.ops_notification_reads TO service_role;
ALTER TABLE public.ops_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self" ON public.ops_notification_reads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 5) QA: Test runs
CREATE TABLE public.ops_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite text NOT NULL,
  branch text,
  commit_sha text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','passed','failed','skipped')),
  total int NOT NULL DEFAULT 0,
  passed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  duration_ms int NOT NULL DEFAULT 0,
  report_url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_test_runs TO authenticated;
GRANT ALL ON public.ops_test_runs TO service_role;
ALTER TABLE public.ops_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff" ON public.ops_test_runs FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));

-- 6) QA: Smoke reports
CREATE TABLE public.ops_smoke_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target text NOT NULL,
  status text NOT NULL DEFAULT 'green' CHECK (status IN ('green','amber','red')),
  latency_ms int,
  http_status int,
  message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ops_smoke_reports TO authenticated;
GRANT ALL ON public.ops_smoke_reports TO service_role;
ALTER TABLE public.ops_smoke_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff" ON public.ops_smoke_reports FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));

-- 7) Releases
CREATE TABLE public.ops_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','staged','published','rolled_back')),
  channel text NOT NULL DEFAULT 'stable' CHECK (channel IN ('alpha','beta','stable')),
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_releases TO authenticated;
GRANT ALL ON public.ops_releases TO service_role;
ALTER TABLE public.ops_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff all" ON public.ops_releases FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));
CREATE POLICY "anyone reads published" ON public.ops_releases FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE TRIGGER touch_releases BEFORE UPDATE ON public.ops_releases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8) Automated events / jobs registry
CREATE TABLE public.ops_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'cron' CHECK (kind IN ('cron','webhook','manual')),
  schedule text,
  target_url text,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  last_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_automations TO authenticated;
GRANT ALL ON public.ops_automations TO service_role;
ALTER TABLE public.ops_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff" ON public.ops_automations FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));
CREATE TRIGGER touch_automations BEFORE UPDATE ON public.ops_automations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 9) Security settings (singleton)
CREATE TABLE public.ops_security_settings (
  id text PRIMARY KEY DEFAULT 'global',
  password_min_length int NOT NULL DEFAULT 12,
  password_require_symbol boolean NOT NULL DEFAULT true,
  password_require_number boolean NOT NULL DEFAULT true,
  mfa_required_roles text[] NOT NULL DEFAULT ARRAY['superadmin','admin']::text[],
  session_ttl_minutes int NOT NULL DEFAULT 720,
  ip_allowlist text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 'global')
);
GRANT SELECT, INSERT, UPDATE ON public.ops_security_settings TO authenticated;
GRANT ALL ON public.ops_security_settings TO service_role;
ALTER TABLE public.ops_security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff" ON public.ops_security_settings FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));
CREATE TRIGGER touch_security_settings BEFORE UPDATE ON public.ops_security_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.ops_security_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- 10) Workspace settings as key/value (general workspace tab) — re-uses platform_settings semantics
CREATE TABLE public.ops_workspace_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_workspace_settings TO authenticated;
GRANT ALL ON public.ops_workspace_settings TO service_role;
ALTER TABLE public.ops_workspace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal staff all" ON public.ops_workspace_settings FOR ALL TO authenticated USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));
CREATE POLICY "anyone reads" ON public.ops_workspace_settings FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER touch_workspace_settings BEFORE UPDATE ON public.ops_workspace_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.ops_workspace_settings (key, value, description) VALUES
  ('brand.name', '"VeloMed OS"'::jsonb, 'Display name across portals'),
  ('brand.support_email', '"support@velomedos.com"'::jsonb, 'Default support email'),
  ('feature.notifications_enabled', 'true'::jsonb, 'Toggle in-app notification center')
ON CONFLICT DO NOTHING;
