
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS national_id_last4 text,
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS member_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Member code generator
CREATE OR REPLACE FUNCTION public.generate_member_code()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'VMD-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
$$;

CREATE OR REPLACE FUNCTION public.profiles_set_member_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.member_code IS NULL THEN
    NEW.member_code := public.generate_member_code();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_member_code ON public.profiles;
CREATE TRIGGER profiles_member_code BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_member_code();

-- Backfill member codes for existing rows
UPDATE public.profiles SET member_code = public.generate_member_code() WHERE member_code IS NULL;

-- 2. Completeness helper
CREATE OR REPLACE FUNCTION public.profile_completeness(_user_id uuid)
RETURNS int LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE((
    SELECT
      (CASE WHEN COALESCE(display_name,full_name) IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN phone IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN dob IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN gender IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN nationality IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN national_id_last4 IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN passport_number IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN blood_type IS NOT NULL THEN 1 ELSE 0 END)
    FROM public.profiles WHERE id = _user_id
  ), 0);
$$;

-- 3. Patient sub-tables
CREATE TABLE IF NOT EXISTS public.patient_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  severity text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_conditions TO authenticated;
GRANT ALL ON public.patient_conditions TO service_role;
ALTER TABLE public.patient_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages conditions" ON public.patient_conditions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.patient_allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  reaction text,
  severity text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_allergies TO authenticated;
GRANT ALL ON public.patient_allergies TO service_role;
ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages allergies" ON public.patient_allergies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.patient_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  relation text,
  phone text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_emergency_contacts TO authenticated;
GRANT ALL ON public.patient_emergency_contacts TO service_role;
ALTER TABLE public.patient_emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages emergency contacts" ON public.patient_emergency_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.patient_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  peer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  peer_label text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_connections TO authenticated;
GRANT ALL ON public.patient_connections TO service_role;
ALTER TABLE public.patient_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages connections" ON public.patient_connections
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.patient_insurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payer text NOT NULL,
  policy_no text,
  status text NOT NULL DEFAULT 'pending',
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_insurance TO authenticated;
GRANT ALL ON public.patient_insurance TO service_role;
ALTER TABLE public.patient_insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads insurance" ON public.patient_insurance
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'paramedic'));
CREATE POLICY "staff writes insurance" ON public.patient_insurance
  FOR ALL USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

DROP TRIGGER IF EXISTS patient_insurance_touch ON public.patient_insurance;
CREATE TRIGGER patient_insurance_touch BEFORE UPDATE ON public.patient_insurance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. OAuth diagnostics
CREATE TABLE IF NOT EXISTS public.oauth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id text,
  user_id uuid,
  email text,
  provider text NOT NULL DEFAULT 'google',
  outcome text NOT NULL,
  code text,
  intended_role text,
  resolved_role text,
  user_agent text,
  ip text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.oauth_events TO authenticated;
GRANT ALL ON public.oauth_events TO service_role;
ALTER TABLE public.oauth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin reads oauth events" ON public.oauth_events
  FOR SELECT USING (public.has_role(auth.uid(),'superadmin'));
CREATE INDEX IF NOT EXISTS idx_oauth_events_created ON public.oauth_events (created_at DESC);
