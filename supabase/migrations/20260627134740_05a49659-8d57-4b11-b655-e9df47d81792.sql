
-- =========================================================
-- 1) Tighten seed-roles trigger
--    - drop velomed.io
--    - require verified email before granting superadmin
-- =========================================================
CREATE OR REPLACE FUNCTION public.assign_seed_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
  _domain text;
  _verified boolean;
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  _domain   := lower(split_part(NEW.email,'@',2));
  _verified := NEW.email_confirmed_at IS NOT NULL;

  IF _verified AND _domain = 'velomedos.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
  END IF;

  IF lower(NEW.email) = 'admin@connectcare.sa' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'business_admin')
      ON CONFLICT DO NOTHING;
    SELECT id INTO _tenant FROM public.corporate_accounts WHERE slug = 'connect-care' LIMIT 1;
    IF _tenant IS NOT NULL THEN
      INSERT INTO public.tenant_members (tenant_id, user_id, role)
        VALUES (_tenant, NEW.id, 'admin')
        ON CONFLICT DO NOTHING;
      UPDATE public.corporate_accounts SET owner_user_id = NEW.id WHERE id = _tenant AND owner_user_id IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Run the seed trigger on email verification too (so verified velomedos.com gets promoted later)
DROP TRIGGER IF EXISTS on_auth_user_confirmed_seed_roles ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_seed_roles
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.assign_seed_roles();

-- Revoke any superadmin/admin grants previously handed out to @velomed.io accounts
DELETE FROM public.user_roles ur
  USING auth.users u
 WHERE ur.user_id = u.id
   AND lower(split_part(u.email,'@',2)) = 'velomed.io'
   AND ur.role IN ('superadmin','admin');

-- =========================================================
-- 2) Subscription plans catalogue
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  price_cents   integer NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'USD',
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','yearly','custom')),
  included_seats integer NOT NULL DEFAULT 5,
  features      jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans readable by signed-in users"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "plans manageable by superadmin"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_subscription_plans_updated
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 3) Tenant subscriptions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status          text NOT NULL DEFAULT 'trialing'
                  CHECK (status IN ('trialing','active','past_due','cancelled','suspended')),
  seats           integer NOT NULL DEFAULT 5,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end   timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  notes           text,
  assigned_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_subscriptions_tenant_idx
  ON public.tenant_subscriptions(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_subscriptions_one_active_per_tenant
  ON public.tenant_subscriptions(tenant_id)
  WHERE status IN ('trialing','active','past_due');

GRANT SELECT ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: superadmin full access"
  ON public.tenant_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "subscriptions: tenant members can read their own"
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tenant_subscriptions.tenant_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_tenant_subscriptions_updated
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 4) Seed default plans
-- =========================================================
INSERT INTO public.subscription_plans (code, name, description, price_cents, currency, billing_period, included_seats, features, sort_order)
VALUES
  ('starter',   'Starter',   'Single station, basic dispatch & fleet tracking.',                  29900,  'USD','monthly',  5,
    '["Dispatch console","Fleet GPS","Up to 5 vehicles","Email support"]'::jsonb, 10),
  ('business',  'Business',  'Multi-station ops with paramedic apps, training & API access.',     99900,  'USD','monthly', 25,
    '["Everything in Starter","Paramedic & driver apps","Training & certification","API + webhooks","Priority support"]'::jsonb, 20),
  ('enterprise','Enterprise','Unlimited fleet, telehealth, compliance vault, dedicated CSM.',    299900,  'USD','monthly',100,
    '["Everything in Business","Telehealth","Compliance vault","SAML SSO","Dedicated CSM","99.95% SLA"]'::jsonb, 30),
  ('custom',    'Custom',    'Bespoke government / national tender package.',                         0,  'USD','custom',  500,
    '["Custom integrations","On-prem option","Negotiated SLA"]'::jsonb, 40)
ON CONFLICT (code) DO NOTHING;

-- Assign Connect Care to Business plan
INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status, seats, current_period_start, current_period_end)
SELECT ca.id, sp.id, 'active', 25, now(), now() + interval '30 days'
  FROM public.corporate_accounts ca
  CROSS JOIN public.subscription_plans sp
 WHERE ca.slug = 'connect-care' AND sp.code = 'business'
   AND NOT EXISTS (
     SELECT 1 FROM public.tenant_subscriptions ts
      WHERE ts.tenant_id = ca.id AND ts.status IN ('trialing','active','past_due')
   );
