
-- Branding & status for tenants
ALTER TABLE public.corporate_accounts
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#e94135',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#5fb8d9',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'pilot',
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'SA';

-- Seed Connect Care
INSERT INTO public.corporate_accounts (company_name, slug, contact_email, contact_phone, logo_url, primary_color, accent_color, status, plan_tier, country)
VALUES ('Connect Care', 'connect-care', 'admin@connectcare.sa', '+966500000000',
  '/__l5e/assets-v1/670cc860-2275-4410-a9f0-898e8c2081a5/connect-care-logo.png',
  '#e94135', '#5fb8d9', 'active', 'business', 'SA')
ON CONFLICT (slug) DO UPDATE SET logo_url = EXCLUDED.logo_url, primary_color = EXCLUDED.primary_color;

-- Membership: which users belong to which tenant
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own" ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "superadmin manage members" ON public.tenant_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Business signup pipeline (inbound)
CREATE TABLE IF NOT EXISTS public.business_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  country text,
  fleet_size int,
  use_case text,
  notes text,
  status text NOT NULL DEFAULT 'new', -- new | reviewing | approved | rejected
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_requests TO authenticated;
GRANT ALL ON public.business_requests TO service_role;
ALTER TABLE public.business_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone submit" ON public.business_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "superadmin read" ON public.business_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "superadmin update" ON public.business_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Platform-wide settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin all" ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin')) WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
INSERT INTO public.platform_settings (key, value) VALUES
  ('branding', '{"product":"VeloMed OS","tagline":"Branch-aware ops for medical mobility"}'::jsonb),
  ('limits', '{"max_tenants":500,"max_units_per_tenant":2000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Auto-promote seeded test accounts on signup
CREATE OR REPLACE FUNCTION public.assign_seed_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid;
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;

  IF lower(split_part(NEW.email,'@',2)) = 'velomed.io' THEN
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
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_seed_roles ON auth.users;
CREATE TRIGGER on_auth_user_created_seed_roles
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_seed_roles();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_seed_roles ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_seed_roles
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.assign_seed_roles();
