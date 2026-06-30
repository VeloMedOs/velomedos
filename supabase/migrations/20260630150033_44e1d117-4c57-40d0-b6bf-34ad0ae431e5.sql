
-- 1) Extend business_requests with display/consent + featured fields
ALTER TABLE public.business_requests
  ADD COLUMN IF NOT EXISTS display_publicly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS display_consent_source text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS display_city text,
  ADD COLUMN IF NOT EXISTS display_type text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS featured_order int;

-- 2) Public-safe view of consented featured partners (no PII columns)
CREATE OR REPLACE VIEW public.public_partners
WITH (security_invoker = true) AS
  SELECT
    COALESCE(display_name, company_name) AS name,
    display_city AS city,
    display_type AS type,
    logo_url,
    COALESCE(featured_order, 999) AS featured_order
  FROM public.business_requests
  WHERE display_publicly = true
    AND display_consent  = true;

GRANT SELECT ON public.public_partners TO anon, authenticated;

-- Allow anon SELECT only on the columns the view projects (security_invoker requires base privileges)
GRANT SELECT (display_name, company_name, display_city, display_type, logo_url, featured_order, display_publicly, display_consent)
  ON public.business_requests TO anon;

-- 3) site_content overlay table
CREATE TABLE IF NOT EXISTS public.site_content (
  key         text NOT NULL,
  locale      text NOT NULL DEFAULT 'en',
  value       jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  updated_by  uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, locale)
);

GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Anon + authenticated may read only published rows
CREATE POLICY "site_content_read_published"
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- Superadmins may read all rows (drafts + published)
CREATE POLICY "site_content_read_all_superadmin"
  ON public.site_content FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Superadmins may write
CREATE POLICY "site_content_write_superadmin"
  ON public.site_content FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER site_content_touch_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) business_request_events: log featured/consent changes
CREATE OR REPLACE FUNCTION public.business_requests_log_featured()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.display_publicly IS DISTINCT FROM OLD.display_publicly THEN
    INSERT INTO public.business_request_events(request_id, actor_id, kind, payload)
    VALUES (NEW.id, auth.uid(), 'featured_changed',
            jsonb_build_object('display_publicly', NEW.display_publicly));
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.display_consent IS DISTINCT FROM OLD.display_consent THEN
    INSERT INTO public.business_request_events(request_id, actor_id, kind, payload)
    VALUES (NEW.id, auth.uid(), 'display_consent_changed',
            jsonb_build_object('display_consent', NEW.display_consent));
    IF NEW.display_consent = true AND NEW.display_consent_at IS NULL THEN
      NEW.display_consent_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS business_requests_log_featured ON public.business_requests;
CREATE TRIGGER business_requests_log_featured
  BEFORE UPDATE ON public.business_requests
  FOR EACH ROW EXECUTE FUNCTION public.business_requests_log_featured();
