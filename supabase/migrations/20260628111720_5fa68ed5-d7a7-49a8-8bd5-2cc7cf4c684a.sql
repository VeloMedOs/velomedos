-- 1) Extend subscription_plans with public-facing display fields ----------
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS eyebrow text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS units_label text,
  ADD COLUMN IF NOT EXISTS seats_label text,
  ADD COLUMN IF NOT EXISTS api_label text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlight boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS cta_to text;

-- Allow anon to read PUBLIC plans only (for the website pricing page).
DO $$ BEGIN
  CREATE POLICY "Public can view public plans"
    ON public.subscription_plans FOR SELECT
    TO anon
    USING (is_public = true AND is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT ON public.subscription_plans TO anon;

-- 2) Seed / upsert the four agreed tiers ----------------------------------
INSERT INTO public.subscription_plans
  (code, name, description, price_cents, currency, billing_period, included_seats, features,
   is_active, sort_order, eyebrow, tagline, units_label, seats_label, api_label,
   is_public, highlight, cta_label, cta_to)
VALUES
  ('starter','Starter','One branch, one crew room, the core console.',149000,'USD','monthly',3,
   '["Dispatch console","Provider + patient apps","Live GPS tracking","Fleet & credential basics","Public API sandbox (10k calls/mo)","Email support · 99.5% SLA"]'::jsonb,
   true, 10,'Single branch','One branch, one crew room, the core console.','Up to 10 units','3 dispatcher seats','API sandbox', true, false,'Start a pilot','/demo'),
  ('operator','Operator','Several branches under one roof, one chain of command.',490000,'USD','monthly',10,
   '["Everything in Starter","Branch → Region hierarchy","Fleet compliance + maintenance","Telehealth add-on ready","Webhooks & SSO (Google)","Priority email support · 99.7% SLA"]'::jsonb,
   true, 20,'Multi-branch','Several branches under one roof, one chain of command.','Up to 50 units','10 dispatcher seats','100k API calls/mo', true, false,'Book a demo','/demo'),
  ('network','Network','Regional operators running multi-tenant, multi-country.',1250000,'USD','monthly',999,
   '["Everything in Operator","Full Org → Branch → Region → Team scoping","Training & Certification LMS","Remote clinic & screening modules","SAML SSO + role privileges matrix","24/7 priority response · 99.9% SLA"]'::jsonb,
   true, 30,'Most chosen','Regional operators running multi-tenant, multi-country.','Up to 200 units','Unlimited seats','1M API calls/mo', true, true,'Book a demo','/demo'),
  ('sovereign','Sovereign','Dedicated cluster, in-country residency, named support.',0,'USD','custom',999,
   '["Everything in Network","Dedicated cluster (single-tenant)","In-country data residency","Custom SLA & DR/BCP runbook","On-prem / private cloud option","24/7 named support · 99.99% SLA"]'::jsonb,
   true, 40,'Regional / national','Dedicated cluster, in-country residency, named support.','Unlimited units','Unlimited seats','Committed throughput', true, false,'Talk to sales','/contact')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  billing_period = EXCLUDED.billing_period,
  included_seats = EXCLUDED.included_seats,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  eyebrow = EXCLUDED.eyebrow,
  tagline = EXCLUDED.tagline,
  units_label = EXCLUDED.units_label,
  seats_label = EXCLUDED.seats_label,
  api_label = EXCLUDED.api_label,
  is_public = EXCLUDED.is_public,
  highlight = EXCLUDED.highlight,
  cta_label = EXCLUDED.cta_label,
  cta_to = EXCLUDED.cta_to;

-- 3) Add-ons catalog -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  unit_label text NOT NULL,
  unit_type text NOT NULL DEFAULT 'per_month',
  price_cents integer,
  price_display text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_addons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_addons TO authenticated;
GRANT ALL ON public.subscription_addons TO service_role;

ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public can view active addons"
    ON public.subscription_addons FOR SELECT
    TO anon, authenticated
    USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Superadmins manage addons"
    ON public.subscription_addons FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'superadmin'))
    WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_subscription_addons_touch ON public.subscription_addons;
CREATE TRIGGER trg_subscription_addons_touch
  BEFORE UPDATE ON public.subscription_addons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.subscription_addons (code,name,unit_label,unit_type,price_display,icon,sort_order) VALUES
  ('remote_clinic_pod','Remote Clinic Pods','per pod / month','per_month','$ 850','Stethoscope',10),
  ('rental_marketplace','Ambulance Rental Marketplace','of GMV','pct_gmv','6 %','Truck',20),
  ('lms','Training & Certification LMS','per learner / year','per_year','$ 38','GraduationCap',30),
  ('api_overage','Public API — metered overage','per 1,000 calls (beyond plan)','per_1k_calls','$ 0.40','Code2',40),
  ('credential_vault','Compliance & Credential Vault','per branch / month','per_month','$ 240','ClipboardCheck',50),
  ('claims_concierge','Insurance Claims Concierge','per recovered claim','per_claim','4 %','Shield',60)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  unit_label = EXCLUDED.unit_label,
  unit_type = EXCLUDED.unit_type,
  price_display = EXCLUDED.price_display,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = true;