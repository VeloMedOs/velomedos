
-- ============================================================================
-- VeloMed OS — Business request lifecycle + CRUD-ready governance surface
-- ============================================================================

-- 1) Pipeline stage + source enums for business_requests -----------------------
DO $$ BEGIN
  CREATE TYPE public.business_request_source AS ENUM ('website','call_center','partner','referral','event','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.business_request_stage AS ENUM ('request','contacted','demo','prospect','lead','negotiation','subscribed','rejected','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Extend business_requests with full business profile ----------------------
ALTER TABLE public.business_requests
  ADD COLUMN IF NOT EXISTS legal_name        text,
  ADD COLUMN IF NOT EXISTS nick_name         text,
  ADD COLUMN IF NOT EXISTS vat_number        text,
  ADD COLUMN IF NOT EXISTS cr_number         text,
  ADD COLUMN IF NOT EXISTS website_url       text,
  ADD COLUMN IF NOT EXISTS address_line      text,
  ADD COLUMN IF NOT EXISTS city              text,
  ADD COLUMN IF NOT EXISTS region            text,
  ADD COLUMN IF NOT EXISTS postal_code       text,
  ADD COLUMN IF NOT EXISTS source            public.business_request_source NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS source_detail     text,
  ADD COLUMN IF NOT EXISTS stage             public.business_request_stage  NOT NULL DEFAULT 'request',
  ADD COLUMN IF NOT EXISTS assigned_to       uuid,
  ADD COLUMN IF NOT EXISTS expected_seats    integer,
  ADD COLUMN IF NOT EXISTS estimated_value_cents bigint,
  ADD COLUMN IF NOT EXISTS currency          text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS converted_tenant_id uuid REFERENCES public.corporate_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by        uuid,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS business_requests_stage_idx  ON public.business_requests(stage);
CREATE INDEX IF NOT EXISTS business_requests_source_idx ON public.business_requests(source);

DROP TRIGGER IF EXISTS business_requests_touch ON public.business_requests;
CREATE TRIGGER business_requests_touch BEFORE UPDATE ON public.business_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Lifecycle event log ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_request_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.business_requests(id) ON DELETE CASCADE,
  actor_id     uuid,
  kind         text NOT NULL,                  -- created | stage_changed | note | assigned | converted | rejected
  from_stage   public.business_request_stage,
  to_stage     public.business_request_stage,
  note         text,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.business_request_events TO authenticated;
GRANT ALL ON public.business_request_events TO service_role;

ALTER TABLE public.business_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin read events" ON public.business_request_events;
CREATE POLICY "superadmin read events" ON public.business_request_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "superadmin insert events" ON public.business_request_events;
CREATE POLICY "superadmin insert events" ON public.business_request_events
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX IF NOT EXISTS business_request_events_request_idx
  ON public.business_request_events(request_id, created_at DESC);

-- 4) Auto-log create + stage transitions --------------------------------------
CREATE OR REPLACE FUNCTION public.business_requests_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.business_request_events(request_id, actor_id, kind, to_stage, payload)
    VALUES (NEW.id, COALESCE(NEW.created_by, auth.uid()), 'created', NEW.stage,
            jsonb_build_object('source', NEW.source, 'company_name', NEW.company_name));
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.business_request_events(request_id, actor_id, kind, from_stage, to_stage)
    VALUES (NEW.id, auth.uid(), 'stage_changed', OLD.stage, NEW.stage);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS business_requests_log_ins ON public.business_requests;
CREATE TRIGGER business_requests_log_ins AFTER INSERT ON public.business_requests
  FOR EACH ROW EXECUTE FUNCTION public.business_requests_log();

DROP TRIGGER IF EXISTS business_requests_log_upd ON public.business_requests;
CREATE TRIGGER business_requests_log_upd AFTER UPDATE ON public.business_requests
  FOR EACH ROW EXECUTE FUNCTION public.business_requests_log();

-- 5) Allow superadmin to insert business_requests directly (UI + API parity) --
DROP POLICY IF EXISTS "superadmin insert business_requests" ON public.business_requests;
CREATE POLICY "superadmin insert business_requests" ON public.business_requests
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "superadmin delete business_requests" ON public.business_requests;
CREATE POLICY "superadmin delete business_requests" ON public.business_requests
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'superadmin'));
