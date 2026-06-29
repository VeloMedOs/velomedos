
-- Phase 0: Clinical foundations for Mini-HIS / NPHIES MDS

-- 1. Clinical role enum
DO $$ BEGIN
  CREATE TYPE public.clinical_role AS ENUM (
    'registrar','physician','nurse','lab_tech','radiologist','pharmacist',
    'coder','case_manager','cashier','tenant_admin','read_only'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Code system kind enum
DO $$ BEGIN
  CREATE TYPE public.code_system_kind AS ENUM (
    'diagnosis','procedure','billing','drg','drug','lab','coding_standard','lov'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Add clinical_role to tenant_members (nullable)
ALTER TABLE public.tenant_members
  ADD COLUMN IF NOT EXISTS clinical_role public.clinical_role;

-- 4. code_system
CREATE TABLE IF NOT EXISTS public.code_system (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  kind public.code_system_kind NOT NULL,
  source_authority text,
  oid text,
  version text,
  edition text,
  is_current boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.code_system TO authenticated;
GRANT ALL ON public.code_system TO service_role;

ALTER TABLE public.code_system ENABLE ROW LEVEL SECURITY;

CREATE POLICY "code_system read for authenticated"
  ON public.code_system FOR SELECT TO authenticated USING (true);
CREATE POLICY "code_system service role write"
  ON public.code_system FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. code_value
CREATE TABLE IF NOT EXISTS public.code_value (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_system_id uuid NOT NULL REFERENCES public.code_system(id) ON DELETE CASCADE,
  code text NOT NULL,
  display text,
  parent_code text,
  active boolean NOT NULL DEFAULT true,
  attributes jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_system_id, code)
);

CREATE INDEX IF NOT EXISTS code_value_system_idx ON public.code_value(code_system_id);
CREATE INDEX IF NOT EXISTS code_value_parent_idx ON public.code_value(code_system_id, parent_code);

GRANT SELECT ON public.code_value TO authenticated;
GRANT ALL ON public.code_value TO service_role;

ALTER TABLE public.code_value ENABLE ROW LEVEL SECURITY;

CREATE POLICY "code_value read for authenticated"
  ON public.code_value FOR SELECT TO authenticated USING (true);
CREATE POLICY "code_value service role write"
  ON public.code_value FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. clinical_audit (tenant-scoped)
CREATE TABLE IF NOT EXISTS public.clinical_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  target text,
  target_id text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clinical_audit_tenant_idx ON public.clinical_audit(tenant_id, created_at DESC);

GRANT SELECT ON public.clinical_audit TO authenticated;
GRANT ALL ON public.clinical_audit TO service_role;

ALTER TABLE public.clinical_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinical_audit tenant members read"
  ON public.clinical_audit FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = clinical_audit.tenant_id AND tm.user_id = auth.uid()
  ));
CREATE POLICY "clinical_audit service role write"
  ON public.clinical_audit FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. updated_at triggers
DROP TRIGGER IF EXISTS touch_code_system ON public.code_system;
CREATE TRIGGER touch_code_system BEFORE UPDATE ON public.code_system
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_code_value ON public.code_value;
CREATE TRIGGER touch_code_value BEFORE UPDATE ON public.code_value
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. Seed code_system rows (KSA-adopted standards)
INSERT INTO public.code_system (key, name, kind, source_authority, version, edition) VALUES
  ('icd-10-am',  'ICD-10-AM (diagnoses)',                'diagnosis',       'IHACPA / CHI', '10th', '10th'),
  ('achi',       'ACHI (interventions/procedures)',      'procedure',       'IHACPA / CHI', '10th', '10th'),
  ('acs',        'Australian Coding Standards',          'coding_standard', 'IHACPA / CHI', '10th', '10th'),
  ('ar-drg',     'AR-DRG (MDC / ADRG / DRG)',            'drg',             'IHACPA / CHI', '9.0',  '9.0'),
  ('sbs',        'Saudi Billing System (non-admitted)',  'billing',         'CHI',          '3',    '3'),
  ('loinc',      'LOINC (lab observations)',             'lab',             'Regenstrief',  'current', NULL),
  ('gtin',       'GTIN (drug trade item / barcode)',     'drug',            'GS1',          NULL,   NULL),
  ('mrid',       'SFDA Medication Registration ID',      'drug',            'SFDA',         NULL,   NULL),
  ('sfda-sci',   'SFDA scientific/drug register code',   'drug',            'SFDA',         NULL,   NULL),
  ('nphies-lov', 'NPHIES LOV / ValueSets (placeholder)', 'lov',             'NPHIES',       NULL,   NULL)
ON CONFLICT (key) DO NOTHING;
