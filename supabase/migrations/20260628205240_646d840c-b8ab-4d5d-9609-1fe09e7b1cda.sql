
DO $$ BEGIN CREATE TYPE public.legal_slug   AS ENUM ('privacy-home','terms-of-service','hipaa','patient-rights'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.legal_locale AS ENUM ('en','ar'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.legal_status AS ENUM ('draft','in_review','published','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drop ALL existing policies on legal_documents up front (they may reference old columns)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT polname FROM pg_policy WHERE polrelid = 'public.legal_documents'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.legal_documents', p.polname);
  END LOOP;
END $$;

UPDATE public.legal_documents SET slug = 'privacy-home'     WHERE slug = 'home';
UPDATE public.legal_documents SET slug = 'terms-of-service' WHERE slug = 'terms';

ALTER TABLE public.legal_documents
  ADD COLUMN IF NOT EXISTS locale       public.legal_locale NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS summary      text,
  ADD COLUMN IF NOT EXISTS body_html    text,
  ADD COLUMN IF NOT EXISTS status       public.legal_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='legal_documents' AND column_name='published') THEN
    UPDATE public.legal_documents SET status = CASE WHEN published THEN 'published'::public.legal_status ELSE 'draft'::public.legal_status END;
    UPDATE public.legal_documents SET published_at = COALESCE(published_at, updated_at) WHERE status = 'published';
    ALTER TABLE public.legal_documents DROP COLUMN published;
  END IF;
END $$;

ALTER TABLE public.legal_documents
  ALTER COLUMN slug TYPE public.legal_slug USING slug::public.legal_slug;

ALTER TABLE public.legal_documents DROP CONSTRAINT IF EXISTS legal_documents_slug_key;
DO $$ BEGIN
  ALTER TABLE public.legal_documents ADD CONSTRAINT legal_documents_slug_locale_unique UNIQUE (slug, locale);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Versions table
CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  slug public.legal_slug NOT NULL,
  locale public.legal_locale NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  summary text,
  body_md text NOT NULL,
  body_html text,
  effective_date date,
  status public.legal_status NOT NULL,
  change_note text,
  actor_id uuid REFERENCES auth.users(id),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, locale, version)
);
GRANT SELECT ON public.legal_document_versions TO authenticated;
GRANT ALL    ON public.legal_document_versions TO service_role;
ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "versions_superadmin_read" ON public.legal_document_versions;
CREATE POLICY "versions_superadmin_read" ON public.legal_document_versions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- Acceptances
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug public.legal_slug NOT NULL,
  locale public.legal_locale NOT NULL,
  version integer NOT NULL,
  subject_id uuid REFERENCES auth.users(id),
  subject_email text,
  ip_hash text,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;
GRANT SELECT, INSERT ON public.legal_acceptances TO anon;
GRANT ALL ON public.legal_acceptances TO service_role;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acceptances_self_insert" ON public.legal_acceptances;
CREATE POLICY "acceptances_self_insert" ON public.legal_acceptances
  FOR INSERT TO authenticated, anon
  WITH CHECK (subject_id IS NULL OR subject_id = auth.uid());
DROP POLICY IF EXISTS "acceptances_self_read" ON public.legal_acceptances;
CREATE POLICY "acceptances_self_read" ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (subject_id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'));

-- Recreate policies on legal_documents
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.legal_documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_documents TO authenticated;
GRANT ALL ON public.legal_documents TO service_role;

CREATE POLICY "legal_docs_public_read_published" ON public.legal_documents
  FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "legal_docs_superadmin_read_all" ON public.legal_documents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "legal_docs_superadmin_insert" ON public.legal_documents
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "legal_docs_superadmin_update" ON public.legal_documents
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "legal_docs_superadmin_delete" ON public.legal_documents
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

-- Trigger: snapshot on publish
CREATE OR REPLACE FUNCTION public.legal_documents_on_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_version integer;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
      FROM public.legal_document_versions
      WHERE slug = NEW.slug AND locale = NEW.locale;
    NEW.version := next_version;
    NEW.published_at := now();
    NEW.published_by := COALESCE(NEW.published_by, auth.uid());
    INSERT INTO public.legal_document_versions
      (document_id, slug, locale, version, title, summary, body_md, body_html, effective_date, status, change_note, actor_id)
    VALUES
      (NEW.id, NEW.slug, NEW.locale, next_version, NEW.title, NEW.summary, NEW.body_md, NEW.body_html,
       NEW.effective_date, NEW.status, NULL, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_legal_documents_on_publish ON public.legal_documents;
CREATE TRIGGER trg_legal_documents_on_publish
  BEFORE INSERT OR UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.legal_documents_on_publish();

-- Seed AR drafts for any missing locale row
INSERT INTO public.legal_documents (slug, locale, title, body_md, status)
SELECT d.slug, 'ar'::public.legal_locale,
       d.title || ' (AR)',
       '# ' || d.title || E'\n\n_الترجمة العربية قيد المراجعة._',
       'draft'::public.legal_status
FROM public.legal_documents d
WHERE d.locale = 'en'
  AND NOT EXISTS (
    SELECT 1 FROM public.legal_documents d2 WHERE d2.slug = d.slug AND d2.locale = 'ar'
  );
