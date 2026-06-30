
CREATE TABLE public.demo_credentials (
  email          text PRIMARY KEY,
  role_label     text NOT NULL,
  clinical_role  text,
  lands_on       text NOT NULL DEFAULT '/clinical',
  password       text NOT NULL,
  sort_order     int  NOT NULL DEFAULT 100,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES auth.users(id)
);

GRANT ALL ON public.demo_credentials TO service_role;

ALTER TABLE public.demo_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin can read demo credentials"
  ON public.demo_credentials FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "superadmin can write demo credentials"
  ON public.demo_credentials FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER demo_credentials_touch
  BEFORE UPDATE ON public.demo_credentials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.demo_credentials (email, role_label, clinical_role, lands_on, password, sort_order) VALUES
  ('superadmin@demo.velomedos.com', 'Superadmin',        NULL,                '/superadmin',                 'DemoVeloMed!2026',  10),
  ('admin@demo.velomedos.com',      'Tenant Admin',      'tenant_admin',      '/clinical?tab=encounters',    'DemoVeloMed!2026',  20),
  ('doctor@demo.velomedos.com',     'Physician',         'physician',         '/clinical?tab=encounters',    'DemoVeloMed!2026',  30),
  ('nurse@demo.velomedos.com',      'Nurse',             'nurse',             '/clinical?tab=encounters',    'DemoVeloMed!2026',  40),
  ('coder@demo.velomedos.com',      'Clinical Coder',    'coder',             '/clinical?tab=coding',        'DemoVeloMed!2026',  50),
  ('rcm@demo.velomedos.com',        'RCM Specialist',    'rcm',               '/clinical?tab=claims',        'DemoVeloMed!2026',  60),
  ('approver@demo.velomedos.com',   'Approval Officer',  'approval_officer',  '/clinical?tab=claims',        'DemoVeloMed!2026',  70),
  ('cashier@demo.velomedos.com',    'Cashier',           'cashier',           '/clinical?tab=claims',        'DemoVeloMed!2026',  80),
  ('biller@demo.velomedos.com',     'Biller',            'biller',            '/clinical?tab=claims',        'DemoVeloMed!2026',  90),
  ('claims@demo.velomedos.com',     'Claims Officer',    'claims_officer',    '/clinical?tab=claims',        'DemoVeloMed!2026', 100),
  ('finance@demo.velomedos.com',    'Finance',           'finance',           '/clinical?tab=claims',        'DemoVeloMed!2026', 110),
  ('readonly@demo.velomedos.com',   'Read-Only Auditor', 'read_only',         '/clinical?tab=encounters',    'DemoVeloMed!2026', 120),
  ('patient@demo.velomedos.com',    'Patient',           NULL,                '/patient',                    'DemoVeloMed!2026', 130)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.platform_settings (key, value)
  VALUES ('demo_public_reveal', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;
