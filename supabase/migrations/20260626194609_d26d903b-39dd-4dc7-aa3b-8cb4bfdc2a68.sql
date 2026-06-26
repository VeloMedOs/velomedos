
-- 1. Add source tagging to incidents
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'console';

-- 2. Public web leads (non-emergency interest captured by the public site)
CREATE TABLE IF NOT EXISTS public.web_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('clinic','screening','rental','training','general')),
  name text NOT NULL,
  phone text,
  email text,
  city text,
  service text,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.web_leads TO authenticated;
GRANT ALL ON public.web_leads TO service_role;

ALTER TABLE public.web_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_leads admin read"
  ON public.web_leads FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'dispatcher'::app_role));

CREATE POLICY "web_leads admin update"
  ON public.web_leads FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'dispatcher'::app_role));

CREATE TRIGGER touch_web_leads_updated_at
  BEFORE UPDATE ON public.web_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS web_leads_created_idx ON public.web_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS web_leads_kind_idx ON public.web_leads(kind, status);
