
DO $$ BEGIN CREATE TYPE public.credential_kind AS ENUM ('paramedic_license','driver_license','vehicle_registration','operating_permit','provider_license'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.work_order_type AS ENUM ('preventive','corrective'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.work_order_status AS ENUM ('open','in_progress','closed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.defect_severity AS ENUM ('minor','major','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.screening_order_status AS ENUM ('booked','sample_collected','results_ready','certified','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fitness_status AS ENUM ('fit','fit_with_restrictions','unfit','pending'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.telehealth_status AS ENUM ('scheduled','live','completed','cancelled','no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.credential_kind NOT NULL,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_ambulance_id uuid REFERENCES public.ambulances(id) ON DELETE CASCADE,
  reference text NOT NULL,
  issuer text,
  issued_on date,
  expires_on date NOT NULL,
  document_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credentials_subject_chk CHECK ((subject_user_id IS NOT NULL)::int + (subject_ambulance_id IS NOT NULL)::int = 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credentials TO authenticated;
GRANT ALL ON public.credentials TO service_role;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials read self or staff" ON public.credentials FOR SELECT TO authenticated USING (
  subject_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher')
);
CREATE POLICY "credentials manage by staff" ON public.credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));

CREATE TABLE public.defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.ambulances(id) ON DELETE CASCADE,
  reported_by uuid REFERENCES auth.users(id),
  severity public.defect_severity NOT NULL DEFAULT 'minor',
  blocks_service boolean NOT NULL DEFAULT false,
  description text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defects TO authenticated;
GRANT ALL ON public.defects TO service_role;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defects read all auth" ON public.defects FOR SELECT TO authenticated USING (true);
CREATE POLICY "defects insert any auth" ON public.defects FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
CREATE POLICY "defects update by staff" ON public.defects FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.ambulances(id) ON DELETE CASCADE,
  type public.work_order_type NOT NULL DEFAULT 'preventive',
  status public.work_order_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  odometer_km integer,
  downtime_minutes integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wo read all auth" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo manage by staff" ON public.work_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));

CREATE TABLE public.work_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  part_no text,
  cost numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_items TO authenticated;
GRANT ALL ON public.work_order_items TO service_role;
ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "woi read all auth" ON public.work_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "woi manage by staff" ON public.work_order_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));

CREATE OR REPLACE VIEW public.dispatchable_ambulances AS
  SELECT a.* FROM public.ambulances a
  WHERE a.status = 'available'
    AND NOT EXISTS (SELECT 1 FROM public.defects d WHERE d.vehicle_id = a.id AND d.blocks_service AND d.resolved_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM public.credentials c WHERE c.subject_ambulance_id = a.id AND c.kind IN ('vehicle_registration','operating_permit') AND c.expires_on < CURRENT_DATE);
GRANT SELECT ON public.dispatchable_ambulances TO authenticated, service_role;

CREATE TABLE public.corporate_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  billing_ref text,
  contact_email text,
  contact_phone text,
  owner_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corporate_accounts TO authenticated;
GRANT ALL ON public.corporate_accounts TO service_role;
ALTER TABLE public.corporate_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corp read own or staff" ON public.corporate_accounts FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));
CREATE POLICY "corp manage by staff or owner" ON public.corporate_accounts FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.screening_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  panel_tests text[] NOT NULL DEFAULT '{}',
  price numeric(10,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.screening_packages TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.screening_packages TO authenticated;
GRANT ALL ON public.screening_packages TO service_role;
ALTER TABLE public.screening_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages public read" ON public.screening_packages FOR SELECT USING (true);
CREATE POLICY "packages manage staff" ON public.screening_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.screening_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_account_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  candidate_id_ref text,
  package_id uuid NOT NULL REFERENCES public.screening_packages(id),
  appointment_at timestamptz,
  status public.screening_order_status NOT NULL DEFAULT 'booked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screening_orders TO authenticated;
GRANT ALL ON public.screening_orders TO service_role;
ALTER TABLE public.screening_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read owner or staff" ON public.screening_orders FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher')
  OR EXISTS (SELECT 1 FROM public.corporate_accounts ca WHERE ca.id = corporate_account_id AND ca.owner_user_id = auth.uid())
);
CREATE POLICY "orders manage owner or staff" ON public.screening_orders FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.corporate_accounts ca WHERE ca.id = corporate_account_id AND ca.owner_user_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.corporate_accounts ca WHERE ca.id = corporate_account_id AND ca.owner_user_id = auth.uid())
);

CREATE TABLE public.screening_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.screening_orders(id) ON DELETE CASCADE,
  test text NOT NULL,
  value text,
  outcome text,
  fitness_status public.fitness_status NOT NULL DEFAULT 'pending',
  certificate_url text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screening_results TO authenticated;
GRANT ALL ON public.screening_results TO service_role;
ALTER TABLE public.screening_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results read via order" ON public.screening_results FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher')
  OR EXISTS (
    SELECT 1 FROM public.screening_orders o
    JOIN public.corporate_accounts ca ON ca.id = o.corporate_account_id
    WHERE o.id = order_id AND ca.owner_user_id = auth.uid()
  )
);
CREATE POLICY "results manage staff" ON public.screening_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));

CREATE TABLE public.telehealth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.clinic_bookings(id) ON DELETE CASCADE,
  room_id text NOT NULL,
  status public.telehealth_status NOT NULL DEFAULT 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telehealth_sessions TO authenticated;
GRANT ALL ON public.telehealth_sessions TO service_role;
ALTER TABLE public.telehealth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "th read participants" ON public.telehealth_sessions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.clinic_bookings b WHERE b.id = booking_id AND b.patient_id = auth.uid())
);
CREATE POLICY "th manage staff" ON public.telehealth_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  payload jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read staff" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));
CREATE INDEX audit_log_at_idx ON public.audit_log (at DESC);
CREATE INDEX audit_log_entity_idx ON public.audit_log (entity, entity_id);

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['fleet:read','incidents:read']::text[],
  ADD COLUMN IF NOT EXISTS rate_limit_per_min integer NOT NULL DEFAULT 60;

CREATE TABLE public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_subscriptions TO authenticated;
GRANT ALL ON public.webhook_subscriptions TO service_role;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs own" ON public.webhook_subscriptions FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status integer,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries own" ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.webhook_subscriptions s WHERE s.id = subscription_id AND s.owner_id = auth.uid()));

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, authenticated, anon;

REVOKE SELECT ON public.clinics FROM anon;
CREATE OR REPLACE VIEW public.clinics_public AS
  SELECT id, name, address, lat, lng, specialties FROM public.clinics;
GRANT SELECT ON public.clinics_public TO anon, authenticated;

DROP POLICY IF EXISTS "events insert any auth" ON public.incident_events;
CREATE POLICY "events insert authorized" ON public.incident_events FOR INSERT TO authenticated WITH CHECK (
  actor_id = auth.uid() AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher')
    OR EXISTS (
      SELECT 1 FROM public.incidents i WHERE i.id = incident_id AND (
        i.requested_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = i.assigned_ambulance_id AND a.driver_id = auth.uid())
      )
    )
  )
);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER credentials_updated_at BEFORE UPDATE ON public.credentials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER screening_orders_updated_at BEFORE UPDATE ON public.screening_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER telehealth_sessions_updated_at BEFORE UPDATE ON public.telehealth_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.screening_packages (name, description, panel_tests, price) VALUES
('Pre-Employment Basic', 'Standard fitness-for-work screening', ARRAY['BP','BMI','Vision','Hearing'], 75.00),
('Drug & Alcohol Panel', '5-panel urine + breath alcohol', ARRAY['THC','COC','OPI','AMP','PCP','Breath-Alcohol'], 120.00),
('Offshore Medical', 'OGUK-aligned offshore physical', ARRAY['ECG','Spirometry','Audio','Vision','Drug-Screen'], 280.00)
ON CONFLICT DO NOTHING;
