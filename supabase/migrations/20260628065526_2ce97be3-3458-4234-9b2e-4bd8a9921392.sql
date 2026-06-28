
-- =====================================================================
-- VeloMed OS — Superadmin Control Plane
-- =====================================================================

-- ---------- portal role enum + assignment + privileges ----------
DO $$ BEGIN
  CREATE TYPE public.portal_role AS ENUM ('superadmin','finance','call_center','developer','analyst');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.portal_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.portal_role NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_role_assignments TO authenticated;
GRANT ALL ON public.portal_role_assignments TO service_role;
ALTER TABLE public.portal_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_portal_role(_user_id uuid, _role public.portal_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_role_assignments WHERE user_id = _user_id AND role = _role
  ) OR (
    -- operator superadmin auto-mirrors to portal superadmin so existing access does not break
    _role = 'superadmin' AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'superadmin'
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_portal_role(uuid, public.portal_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_portal_role(uuid, public.portal_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_portal_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.portal_role_assignments WHERE user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'superadmin');
$$;
REVOKE EXECUTE ON FUNCTION public.is_portal_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_portal_staff(uuid) TO authenticated, service_role;

CREATE POLICY portal_assignments_read ON public.portal_role_assignments
  FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY portal_assignments_write ON public.portal_role_assignments
  FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin'));

CREATE TABLE IF NOT EXISTS public.portal_role_privileges (
  role public.portal_role NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_manage boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_role_privileges TO authenticated;
GRANT ALL ON public.portal_role_privileges TO service_role;
ALTER TABLE public.portal_role_privileges ENABLE ROW LEVEL SECURITY;
CREATE POLICY pport_priv_read ON public.portal_role_privileges
  FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pport_priv_write ON public.portal_role_privileges
  FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin'));

-- ---------- subscriptions / billing ----------
CREATE TABLE IF NOT EXISTS public.portal_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  plan text NOT NULL,
  seats int NOT NULL DEFAULT 1,
  price_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  cycle text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  renews_at timestamptz,
  gateway_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_subscriptions TO authenticated;
GRANT ALL ON public.portal_subscriptions TO service_role;
ALTER TABLE public.portal_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY psub_read ON public.portal_subscriptions FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY psub_write ON public.portal_subscriptions FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'));
CREATE TRIGGER psub_touch BEFORE UPDATE ON public.portal_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.portal_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.portal_subscriptions(id) ON DELETE SET NULL,
  method text NOT NULL CHECK (method IN ('card','online','bank_transfer','complimentary')),
  amount_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  receipt_url text,
  txn_ref text,
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_payments TO authenticated;
GRANT ALL ON public.portal_payments TO service_role;
ALTER TABLE public.portal_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppay_read ON public.portal_payments FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY ppay_write ON public.portal_payments FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'));

CREATE TABLE IF NOT EXISTS public.portal_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('percent','flat','trial_extension')),
  value numeric NOT NULL,
  valid_until timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_promotions TO authenticated;
GRANT ALL ON public.portal_promotions TO service_role;
ALTER TABLE public.portal_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pprom_read ON public.portal_promotions FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pprom_write ON public.portal_promotions FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'));

CREATE TABLE IF NOT EXISTS public.portal_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  amount_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  reason text,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_credits TO authenticated;
GRANT ALL ON public.portal_credits TO service_role;
ALTER TABLE public.portal_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcred_read ON public.portal_credits FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pcred_write ON public.portal_credits FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'));

CREATE TABLE IF NOT EXISTS public.portal_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  number text NOT NULL,
  amount_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'open',
  issued_at timestamptz NOT NULL DEFAULT now(),
  gateway_invoice_id text,
  pdf_url text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_invoices TO authenticated;
GRANT ALL ON public.portal_invoices TO service_role;
ALTER TABLE public.portal_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY pinv_read ON public.portal_invoices FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pinv_write ON public.portal_invoices FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'finance'));

-- ---------- tickets / bugs ----------
CREATE TABLE IF NOT EXISTS public.portal_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid REFERENCES public.corporate_accounts(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('new_business','follow_up','bug','change_request')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  subject text NOT NULL,
  body text,
  assignee_id uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_tickets TO authenticated;
GRANT ALL ON public.portal_tickets TO service_role;
ALTER TABLE public.portal_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptick_read ON public.portal_tickets FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY ptick_write ON public.portal_tickets FOR ALL TO authenticated
  USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));
CREATE TRIGGER ptick_touch BEFORE UPDATE ON public.portal_tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.portal_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.portal_tickets(id) ON DELETE CASCADE,
  body text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_ticket_events TO authenticated;
GRANT ALL ON public.portal_ticket_events TO service_role;
ALTER TABLE public.portal_ticket_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ptev_read ON public.portal_ticket_events FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY ptev_write ON public.portal_ticket_events FOR ALL TO authenticated
  USING (public.is_portal_staff(auth.uid())) WITH CHECK (public.is_portal_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.portal_bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid REFERENCES public.corporate_accounts(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'internal' CHECK (source IN ('sentry','internal','playwright')),
  external_ref text,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  count int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaged','resolved','ignored')),
  assignee_id uuid REFERENCES auth.users(id),
  stack_url text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_bugs TO authenticated;
GRANT ALL ON public.portal_bugs TO service_role;
ALTER TABLE public.portal_bugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pbug_read ON public.portal_bugs FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pbug_write ON public.portal_bugs FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'developer'));

-- ---------- base + customization layers ----------
CREATE TABLE IF NOT EXISTS public.portal_config_base (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_config_base TO authenticated;
GRANT ALL ON public.portal_config_base TO service_role;
ALTER TABLE public.portal_config_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcfg_base_read ON public.portal_config_base FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pcfg_base_write ON public.portal_config_base FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'developer'));

CREATE TABLE IF NOT EXISTS public.portal_config_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_config_overrides TO authenticated;
GRANT ALL ON public.portal_config_overrides TO service_role;
ALTER TABLE public.portal_config_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY pcfg_ov_read ON public.portal_config_overrides FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pcfg_ov_write ON public.portal_config_overrides FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin') OR public.has_portal_role(auth.uid(), 'developer'));

CREATE OR REPLACE FUNCTION public.portal_effective_config(_subscriber uuid)
RETURNS TABLE(key text, value jsonb, source text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.key, COALESCE(o.value, b.value) AS value,
         CASE WHEN o.value IS NULL THEN 'base' ELSE 'override' END AS source,
         COALESCE(o.updated_at, b.updated_at)
  FROM public.portal_config_base b
  LEFT JOIN public.portal_config_overrides o
    ON o.key = b.key AND o.subscriber_id = _subscriber
$$;
REVOKE EXECUTE ON FUNCTION public.portal_effective_config(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_effective_config(uuid) TO authenticated, service_role;

-- ---------- usage daily + portal audit ----------
CREATE TABLE IF NOT EXISTS public.portal_usage_daily (
  subscriber_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  day date NOT NULL,
  api_calls int NOT NULL DEFAULT 0,
  active_branches int NOT NULL DEFAULT 0,
  active_teams int NOT NULL DEFAULT 0,
  incidents int NOT NULL DEFAULT 0,
  PRIMARY KEY(subscriber_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_usage_daily TO authenticated;
GRANT ALL ON public.portal_usage_daily TO service_role;
ALTER TABLE public.portal_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY pusage_read ON public.portal_usage_daily FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pusage_write ON public.portal_usage_daily FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin'));

CREATE TABLE IF NOT EXISTS public.portal_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target text,
  target_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.portal_audit TO authenticated;
GRANT ALL ON public.portal_audit TO service_role;
ALTER TABLE public.portal_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY paud_read ON public.portal_audit FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY paud_insert ON public.portal_audit FOR INSERT TO authenticated WITH CHECK (public.is_portal_staff(auth.uid()));

-- ---------- portal API keys (separate surface from public api_keys) ----------
CREATE TABLE IF NOT EXISTS public.portal_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prefix text NOT NULL,
  hashed_key text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  rate_limit_per_min int NOT NULL DEFAULT 300,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_api_keys TO authenticated;
GRANT ALL ON public.portal_api_keys TO service_role;
ALTER TABLE public.portal_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY pak_read ON public.portal_api_keys FOR SELECT TO authenticated USING (public.is_portal_staff(auth.uid()));
CREATE POLICY pak_write ON public.portal_api_keys FOR ALL TO authenticated
  USING (public.has_portal_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_portal_role(auth.uid(), 'superadmin'));

-- ---------- seed extra subscribers + activity ----------
INSERT INTO public.corporate_accounts (slug, company_name, country, status, plan_tier, logo_url)
VALUES
  ('connect-care',      'Connect Care',           'SA', 'active',    'scale',      NULL),
  ('riyadh-medics',     'Riyadh Medics',          'SA', 'active',    'enterprise', NULL),
  ('najm-rescue',       'Najm Rescue',            'SA', 'trialing',  'starter',    NULL),
  ('dunes-mobile',      'Dunes Mobile Health',    'AE', 'active',    'scale',      NULL),
  ('kuwait-aid',        'Kuwait Aid Co-op',       'KW', 'past_due',  'starter',    NULL),
  ('cairo-paramed',     'Cairo Paramedical',      'EG', 'active',    'scale',      NULL),
  ('amman-relay',       'Amman Relay Health',     'JO', 'churned',   'starter',    NULL),
  ('doha-onsite',       'Doha Onsite Clinics',    'QA', 'trialing',  'enterprise', NULL),
  ('manama-care',       'Manama Care Network',    'BH', 'active',    'scale',      NULL),
  ('beirut-bls',        'Beirut BLS Group',       'LB', 'suspended', 'starter',    NULL)
ON CONFLICT (slug) DO NOTHING;

-- subscriptions, invoices, payments, promotions, bugs, tickets, usage — generated per-subscriber
DO $$
DECLARE r RECORD; i int; d date; price int; cyc text; st text; BEGIN
  FOR r IN SELECT id, slug, status, plan_tier FROM public.corporate_accounts LOOP
    -- subscription
    price := CASE r.plan_tier WHEN 'enterprise' THEN 249900 WHEN 'scale' THEN 89900 ELSE 29900 END;
    cyc := 'monthly';
    st := CASE r.status WHEN 'churned' THEN 'cancelled' WHEN 'suspended' THEN 'past_due' WHEN 'trialing' THEN 'trialing' WHEN 'past_due' THEN 'past_due' ELSE 'active' END;
    IF NOT EXISTS (SELECT 1 FROM public.portal_subscriptions WHERE subscriber_id = r.id) THEN
      INSERT INTO public.portal_subscriptions(subscriber_id, plan, seats, price_cents, currency, cycle, status, started_at, renews_at)
      VALUES (r.id, r.plan_tier, CASE r.plan_tier WHEN 'enterprise' THEN 50 WHEN 'scale' THEN 15 ELSE 5 END,
              price, 'USD', cyc, st, now() - interval '90 days', now() + interval '20 days');
    END IF;

    -- two invoices each
    FOR i IN 0..1 LOOP
      IF NOT EXISTS (SELECT 1 FROM public.portal_invoices WHERE subscriber_id = r.id AND number = 'INV-' || upper(r.slug) || '-' || (1001 + i)) THEN
        INSERT INTO public.portal_invoices(subscriber_id, number, amount_cents, currency, status, issued_at)
        VALUES (r.id, 'INV-' || upper(r.slug) || '-' || (1001 + i), price, 'USD',
                CASE WHEN i = 0 THEN 'paid' WHEN st IN ('past_due','cancelled') THEN 'overdue' ELSE 'open' END,
                now() - ((i+1) * interval '30 days'));
      END IF;
    END LOOP;

    -- one card payment + (for 3 of them) a pending bank-transfer
    IF NOT EXISTS (SELECT 1 FROM public.portal_payments WHERE subscriber_id = r.id) THEN
      INSERT INTO public.portal_payments(subscriber_id, method, amount_cents, currency, status, txn_ref, validated_at)
      VALUES (r.id, 'card', price, 'USD', 'succeeded', 'ch_' || substr(md5(random()::text), 1, 18), now() - interval '28 days');
      IF r.slug IN ('connect-care','dunes-mobile','manama-care') THEN
        INSERT INTO public.portal_payments(subscriber_id, method, amount_cents, currency, status, txn_ref, receipt_url)
        VALUES (r.id, 'bank_transfer', price, 'USD', 'pending', 'WIRE-' || upper(r.slug) || '-' || extract(epoch from now())::int,
                'https://example.com/receipts/' || r.slug || '.pdf');
      END IF;
    END IF;

    -- usage daily 60 days
    FOR i IN 0..59 LOOP
      d := (now() - (i || ' days')::interval)::date;
      INSERT INTO public.portal_usage_daily(subscriber_id, day, api_calls, active_branches, active_teams, incidents)
      VALUES (r.id, d,
        GREATEST(0, (200 + (random()*800)::int - CASE WHEN r.status IN ('churned','suspended') THEN 600 ELSE 0 END)),
        CASE r.plan_tier WHEN 'enterprise' THEN 8 WHEN 'scale' THEN 3 ELSE 1 END,
        CASE r.plan_tier WHEN 'enterprise' THEN 24 WHEN 'scale' THEN 9 ELSE 2 END,
        (random()*12)::int)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- promotions
INSERT INTO public.portal_promotions(code, type, value, valid_until, notes) VALUES
  ('LAUNCH2026', 'percent', 20, now() + interval '90 days', 'Public launch promo'),
  ('GULF-EXPANSION', 'flat', 5000, now() + interval '180 days', 'Regional partner discount')
ON CONFLICT (code) DO NOTHING;

-- sentry-style bugs across 6 subscribers
DO $$ DECLARE r RECORD; sevs text[] := ARRAY['low','medium','high','critical']; BEGIN
  FOR r IN SELECT id, slug FROM public.corporate_accounts WHERE slug IN ('connect-care','riyadh-medics','dunes-mobile','cairo-paramed','doha-onsite','manama-care') LOOP
    INSERT INTO public.portal_bugs(subscriber_id, source, external_ref, title, severity, count, status, last_seen_at)
    VALUES
      (r.id, 'sentry', 'SENTRY-' || upper(r.slug) || '-1', 'TypeError: cannot read properties of undefined (reading "ambulance")', sevs[1 + (random()*3)::int], (10 + random()*200)::int, 'open',     now() - interval '2 hours'),
      (r.id, 'sentry', 'SENTRY-' || upper(r.slug) || '-2', 'NetworkError: timeout calling /api/public/v1/eta',                     sevs[1 + (random()*3)::int], (3  + random()*60)::int,  'triaged',  now() - interval '8 hours');
  END LOOP;
END $$;

-- tickets across queue
INSERT INTO public.portal_tickets(subscriber_id, type, priority, status, subject, body)
SELECT id,
       (ARRAY['new_business','follow_up','bug','change_request'])[1 + (abs(hashtext(slug)) % 4)],
       (ARRAY['low','normal','high','urgent'])[1 + (abs(hashtext(slug || '-p')) % 4)],
       (ARRAY['open','in_progress','waiting'])[1 + (abs(hashtext(slug || '-s')) % 3)],
       'Inbound from ' || company_name,
       'Auto-seeded ticket for ' || company_name || ' (' || country || ').'
FROM public.corporate_accounts
ON CONFLICT DO NOTHING;

-- base config + a few overrides
INSERT INTO public.portal_config_base(key, value, description) VALUES
  ('modules.telehealth', 'true'::jsonb, 'Telehealth video sessions'),
  ('modules.training',   'true'::jsonb, 'Training & certification module'),
  ('modules.screening',  'true'::jsonb, 'Mobile screening orders'),
  ('limits.api_rpm',     '60'::jsonb,   'Default per-key rate limit'),
  ('limits.seats',       '10'::jsonb,   'Default seat allowance'),
  ('branding.primary',   '"#28D6B6"'::jsonb, 'Default brand primary')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.portal_config_overrides(subscriber_id, key, value)
SELECT c.id, 'limits.seats', '50'::jsonb FROM public.corporate_accounts c WHERE c.slug = 'riyadh-medics'
ON CONFLICT DO NOTHING;
INSERT INTO public.portal_config_overrides(subscriber_id, key, value)
SELECT c.id, 'limits.api_rpm', '300'::jsonb FROM public.corporate_accounts c WHERE c.slug = 'doha-onsite'
ON CONFLICT DO NOTHING;

-- default portal role privileges matrix (5 roles x ~12 modules)
INSERT INTO public.portal_role_privileges(role, module, can_view, can_manage) VALUES
  ('superadmin','overview',true,true),('superadmin','subscribers',true,true),('superadmin','billing',true,true),
  ('superadmin','tickets',true,true),('superadmin','bugs',true,true),('superadmin','config',true,true),
  ('superadmin','analytics',true,true),('superadmin','roles',true,true),('superadmin','api',true,true),
  ('superadmin','monitoring',true,true),('superadmin','audit',true,true),('superadmin','debug',true,true),
  ('finance','overview',true,false),('finance','subscribers',true,false),('finance','billing',true,true),
  ('finance','analytics',true,false),('finance','api',true,false),
  ('call_center','overview',true,false),('call_center','subscribers',true,false),('call_center','tickets',true,true),
  ('call_center','api',true,false),
  ('developer','overview',true,false),('developer','subscribers',true,false),('developer','bugs',true,true),
  ('developer','config',true,true),('developer','debug',true,true),('developer','api',true,true),
  ('analyst','overview',true,false),('analyst','analytics',true,false),('analyst','monitoring',true,false),('analyst','api',true,false)
ON CONFLICT (role, module) DO NOTHING;
