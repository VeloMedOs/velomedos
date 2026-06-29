-- Phase 6: Clinical Coding + AR-DRG Grouper

-- 1) clinical_coding
CREATE TABLE public.clinical_coding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL UNIQUE REFERENCES public.encounter(id) ON DELETE CASCADE,
  coder_id uuid,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','coded','amended')),
  principal_diagnosis_id uuid REFERENCES public.encounter_diagnosis(id) ON DELETE SET NULL,
  coded_at timestamptz,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_coding TO authenticated;
GRANT ALL ON public.clinical_coding TO service_role;

ALTER TABLE public.clinical_coding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coding tenant read" ON public.clinical_coding FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coding tenant insert" ON public.clinical_coding FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coding tenant update" ON public.clinical_coding FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "coding tenant delete" ON public.clinical_coding FOR DELETE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER trg_clinical_coding_touch
  BEFORE UPDATE ON public.clinical_coding
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Advance journey to 'coded' when status flips to coded
CREATE OR REPLACE FUNCTION public.coding_advance_journey()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'coded' THEN
    PERFORM public.encounter_advance_journey(NEW.encounter_id, 'coded');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_clinical_coding_journey
  AFTER INSERT OR UPDATE ON public.clinical_coding
  FOR EACH ROW EXECUTE FUNCTION public.coding_advance_journey();

-- 2) drg_assignment
CREATE TABLE public.drg_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  drg_id uuid REFERENCES public.drg(id) ON DELETE SET NULL,
  drg_code text NOT NULL,
  drg_version text NOT NULL,
  mdc text,
  adrg text,
  partition text,
  complexity_score numeric,
  grouper_name text,
  grouper_version text,
  grouper_request jsonb,
  grouper_response jsonb,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','superseded')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX drg_assignment_one_active
  ON public.drg_assignment (encounter_id) WHERE status = 'assigned';
CREATE INDEX drg_assignment_encounter_idx ON public.drg_assignment (encounter_id, assigned_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drg_assignment TO authenticated;
GRANT ALL ON public.drg_assignment TO service_role;

ALTER TABLE public.drg_assignment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drg_assignment tenant read" ON public.drg_assignment FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_assignment tenant insert" ON public.drg_assignment FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_assignment tenant update" ON public.drg_assignment FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "drg_assignment tenant delete" ON public.drg_assignment FOR DELETE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER trg_drg_assignment_touch
  BEFORE UPDATE ON public.drg_assignment
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Supersede prior 'assigned' on insert of a new 'assigned'
CREATE OR REPLACE FUNCTION public.drg_assignment_supersede()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'assigned' THEN
    UPDATE public.drg_assignment
       SET status = 'superseded'
     WHERE encounter_id = NEW.encounter_id
       AND id <> NEW.id
       AND status = 'assigned';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_drg_assignment_supersede
  BEFORE INSERT ON public.drg_assignment
  FOR EACH ROW EXECUTE FUNCTION public.drg_assignment_supersede();

-- Advance journey to 'grouped'
CREATE OR REPLACE FUNCTION public.drg_advance_journey()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'assigned' THEN
    PERFORM public.encounter_advance_journey(NEW.encounter_id, 'grouped');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_drg_assignment_journey
  AFTER INSERT ON public.drg_assignment
  FOR EACH ROW EXECUTE FUNCTION public.drg_advance_journey();