
CREATE TABLE public.resource_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_kind text NOT NULL CHECK (resource_kind IN ('vehicle','paramedic','doctor')),
  resource_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed_kmh double precision,
  heading double precision,
  accuracy_m double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_resource_locations_resource ON public.resource_locations(resource_kind, resource_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.resource_locations TO authenticated;
GRANT ALL ON public.resource_locations TO service_role;
ALTER TABLE public.resource_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read locations" ON public.resource_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert locations" ON public.resource_locations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_kind text NOT NULL CHECK (resource_kind IN ('vehicle','paramedic','doctor')),
  resource_id uuid NOT NULL,
  incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  distance_km double precision DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  max_speed_kmh double precision DEFAULT 0,
  avg_speed_kmh double precision DEFAULT 0,
  polyline text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trips_resource ON public.trips(resource_kind, resource_id, started_at DESC);
CREATE INDEX idx_trips_incident ON public.trips(incident_id);
GRANT SELECT, INSERT, UPDATE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read trips" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write trips" ON public.trips FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update trips" ON public.trips FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trips_touch BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.trip_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_shares_token ON public.trip_shares(token);
GRANT SELECT, INSERT, UPDATE ON public.trip_shares TO authenticated;
GRANT ALL ON public.trip_shares TO service_role;
ALTER TABLE public.trip_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage shares" ON public.trip_shares FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
