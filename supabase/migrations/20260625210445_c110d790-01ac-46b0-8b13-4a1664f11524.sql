
-- ============== ENUMS ==============
CREATE TYPE public.app_role AS ENUM ('admin','dispatcher','paramedic','driver','patient','developer');
CREATE TYPE public.ambulance_status AS ENUM ('available','en_route','on_scene','transporting','out_of_service');
CREATE TYPE public.ambulance_type AS ENUM ('BLS','ALS','ICU','NEONATAL');
CREATE TYPE public.incident_severity AS ENUM ('code_red','code_yellow','routine');
CREATE TYPE public.incident_status AS ENUM ('pending','assigned','en_route','on_scene','transporting','completed','cancelled');
CREATE TYPE public.booking_status AS ENUM ('requested','confirmed','completed','cancelled');

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  default_role public.app_role NOT NULL DEFAULT 'patient',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============== USER ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

-- ============== Auto-create profile + default role on signup ==============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, default_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    'patient'
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== AMBULANCES ==============
CREATE TABLE public.ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type public.ambulance_type NOT NULL DEFAULT 'BLS',
  status public.ambulance_status NOT NULL DEFAULT 'available',
  home_base TEXT,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_ping_at TIMESTAMPTZ,
  daily_rate NUMERIC(10,2) DEFAULT 240,
  available_for_rent BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ambulances TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambulances TO authenticated;
GRANT ALL ON public.ambulances TO service_role;
ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ambulances readable by all" ON public.ambulances FOR SELECT USING (true);
CREATE POLICY "ambulances driver self-update" ON public.ambulances FOR UPDATE TO authenticated
  USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher'));
CREATE POLICY "ambulances admin insert" ON public.ambulances FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ambulances admin delete" ON public.ambulances FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============== AMBULANCE LOCATIONS (trail) ==============
CREATE TABLE public.ambulance_locations (
  id BIGSERIAL PRIMARY KEY,
  ambulance_id UUID NOT NULL REFERENCES public.ambulances(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.ambulance_locations (ambulance_id, recorded_at DESC);
GRANT SELECT ON public.ambulance_locations TO anon, authenticated;
GRANT INSERT ON public.ambulance_locations TO authenticated;
GRANT ALL ON public.ambulance_locations TO service_role;
ALTER TABLE public.ambulance_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations readable" ON public.ambulance_locations FOR SELECT USING (true);
CREATE POLICY "locations driver insert" ON public.ambulance_locations FOR INSERT TO authenticated WITH CHECK (true);

-- ============== INCIDENTS ==============
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE DEFAULT ('INC-' || lpad((floor(random()*99999))::text,5,'0')),
  severity public.incident_severity NOT NULL DEFAULT 'routine',
  caller_name TEXT,
  caller_phone TEXT,
  patient_name TEXT,
  address TEXT,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  symptoms TEXT,
  status public.incident_status NOT NULL DEFAULT 'pending',
  sla_target_at TIMESTAMPTZ,
  assigned_ambulance_id UUID REFERENCES public.ambulances(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
-- Dispatchers/admins see all; paramedic/driver see those assigned to their ambulance; patient sees own requests
CREATE POLICY "incidents staff read" ON public.incidents FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher')
  OR requested_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = incidents.assigned_ambulance_id AND a.driver_id = auth.uid())
);
CREATE POLICY "incidents patient create" ON public.incidents FOR INSERT TO authenticated WITH CHECK (
  requested_by = auth.uid() OR public.has_role(auth.uid(),'dispatcher') OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "incidents staff update" ON public.incidents FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher')
  OR EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = incidents.assigned_ambulance_id AND a.driver_id = auth.uid())
);

CREATE TABLE public.incident_events (
  id BIGSERIAL PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.incident_events (incident_id, at DESC);
GRANT SELECT, INSERT ON public.incident_events TO authenticated;
GRANT ALL ON public.incident_events TO service_role;
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events same as incident" ON public.incident_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_events.incident_id
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher')
      OR i.requested_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.ambulances a WHERE a.id = i.assigned_ambulance_id AND a.driver_id = auth.uid())))
);
CREATE POLICY "events insert any auth" ON public.incident_events FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- ============== CLINICS ==============
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  specialties TEXT[],
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clinics TO anon, authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinics public read" ON public.clinics FOR SELECT USING (true);

CREATE TABLE public.clinic_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  slot_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status public.booking_status NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clinic_bookings TO authenticated;
GRANT ALL ON public.clinic_bookings TO service_role;
ALTER TABLE public.clinic_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings self" ON public.clinic_bookings FOR SELECT TO authenticated USING (
  patient_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'dispatcher')
);
CREATE POLICY "bookings self insert" ON public.clinic_bookings FOR INSERT TO authenticated WITH CHECK (patient_id = auth.uid());
CREATE POLICY "bookings self update" ON public.clinic_bookings FOR UPDATE TO authenticated USING (
  patient_id = auth.uid() OR public.has_role(auth.uid(),'admin')
);

-- ============== RENTALS ==============
CREATE TABLE public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambulance_id UUID NOT NULL REFERENCES public.ambulances(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  daily_rate NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2),
  notes TEXT,
  status public.booking_status NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rentals TO authenticated;
GRANT ALL ON public.rentals TO service_role;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rentals self" ON public.rentals FOR SELECT TO authenticated USING (
  customer_id = auth.uid() OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "rentals self create" ON public.rentals FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "rentals admin update" ON public.rentals FOR UPDATE TO authenticated USING (
  customer_id = auth.uid() OR public.has_role(auth.uid(),'admin')
);

-- ============== TRAINING ==============
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  level TEXT,
  duration_hours INTEGER DEFAULT 0,
  price NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses public read" ON public.courses FOR SELECT USING (true);

CREATE TABLE public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  UNIQUE (course_id, idx)
);
GRANT SELECT ON public.course_modules TO anon, authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules public read" ON public.course_modules FOR SELECT USING (true);

CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments self" ON public.enrollments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "enrollments self insert" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "enrollments self update" ON public.enrollments FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL UNIQUE REFERENCES public.enrollments(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE DEFAULT ('VM-' || upper(substring(replace(gen_random_uuid()::text,'-',''),1,10))),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.certificates TO anon, authenticated;
GRANT INSERT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certs public verify" ON public.certificates FOR SELECT USING (true);
CREATE POLICY "certs self insert" ON public.certificates FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.user_id = auth.uid())
);

-- ============== API KEYS ==============
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hashed_key TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apikeys self" ON public.api_keys FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "apikeys self insert" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "apikeys self delete" ON public.api_keys FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ============== Realtime ==============
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambulance_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambulances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;

-- ============== SEED ==============
INSERT INTO public.ambulances (code, type, status, home_base, current_lat, current_lng, daily_rate, last_ping_at) VALUES
  ('AMB-401','ALS','available','Central Station',40.7580,-73.9855,320, now()),
  ('AMB-402','ALS','en_route','Central Station',40.7614,-73.9776,320, now()),
  ('AMB-403','BLS','available','North Depot',40.7831,-73.9712,240, now()),
  ('AMB-404','ICU','out_of_service','Central Station',40.7480,-73.9857,520, now()),
  ('AMB-405','BLS','available','South Depot',40.7282,-74.0060,240, now()),
  ('AMB-406','NEONATAL','available','Maternity Hub',40.7589,-73.9851,480, now());

INSERT INTO public.clinics (name, address, lat, lng, specialties, phone) VALUES
  ('Mercy Remote Care', '120 W 34th St', 40.7505, -73.9934, ARRAY['General','Pediatrics'], '+1-212-555-0142'),
  ('Heartline Cardiology', '500 5th Ave', 40.7544, -73.9819, ARRAY['Cardiology'], '+1-212-555-0188'),
  ('North Bridge Trauma', '2400 Broadway', 40.7891, -73.9745, ARRAY['Trauma','Orthopedics'], '+1-212-555-0190');

INSERT INTO public.courses (title, summary, level, duration_hours, price) VALUES
  ('Advanced Life Support (ALS) Recertification','Two-day refresher covering airway, cardiac, and trauma protocols.','Advanced',16,480),
  ('EMT-Basic Bridge Program','Foundational paramedic prep with patient assessment and BLS.','Basic',40,720),
  ('Tactical Paramedic Operations','Field operations under high-acuity tactical conditions.','Specialist',24,960);

WITH c1 AS (SELECT id FROM public.courses WHERE title LIKE 'Advanced Life%')
INSERT INTO public.course_modules (course_id, idx, title, content)
SELECT id, idx, title, content FROM c1, (VALUES
  (1,'Airway Management','Advanced airway adjuncts and rapid sequence intubation.'),
  (2,'Cardiac Arrest Algorithms','ACLS pathways including ROSC and post-arrest care.'),
  (3,'Trauma Triage','START and JumpSTART in mass casualty events.'),
  (4,'Final Practical','Hands-on scenarios and proctored exam.')
) AS m(idx,title,content);
