CREATE TABLE IF NOT EXISTS public.nav_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  target_path text NOT NULL,
  surface text NOT NULL,
  referrer text,
  locale text,
  user_agent_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nav_events_event_name_idx ON public.nav_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS nav_events_target_path_idx ON public.nav_events (target_path, occurred_at DESC);

GRANT INSERT ON public.nav_events TO anon, authenticated;
GRANT ALL ON public.nav_events TO service_role;

ALTER TABLE public.nav_events ENABLE ROW LEVEL SECURITY;

-- Anonymous insert-only telemetry; no SELECT to anon/authenticated. Admin reads go via service_role.
CREATE POLICY "anyone can insert nav events"
  ON public.nav_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(event_name) BETWEEN 1 AND 64
    AND char_length(target_path) BETWEEN 1 AND 256
    AND char_length(surface) BETWEEN 1 AND 32
  );