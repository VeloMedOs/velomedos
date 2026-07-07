
-- Turn 2b Migration 2 — HIM communication channel.

CREATE TABLE public.him_communication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id) ON DELETE CASCADE,
  form_instance_id uuid NULL REFERENCES public.clinical_form_instance(id) ON DELETE SET NULL,
  coding_row_id uuid NULL REFERENCES public.clinical_coding(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  channel text,
  author uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  payload jsonb,
  read_at timestamptz NULL,
  read_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX him_communication_encounter_idx  ON public.him_communication (encounter_id, created_at DESC);
CREATE INDEX him_communication_tenant_idx     ON public.him_communication (tenant_id, created_at DESC);
CREATE INDEX him_communication_unread_idx     ON public.him_communication (encounter_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.him_communication TO authenticated;
GRANT ALL ON public.him_communication TO service_role;

ALTER TABLE public.him_communication ENABLE ROW LEVEL SECURITY;

CREATE POLICY "him_comm_tenant_select" ON public.him_communication
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "him_comm_tenant_insert" ON public.him_communication
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND author = auth.uid()
    AND direction = 'outbound'
  );

CREATE POLICY "him_comm_tenant_update_read" ON public.him_communication
  FOR UPDATE TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER him_communication_touch
  BEFORE UPDATE ON public.him_communication
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Companion thread view: author name + is_read_by_me marker.
CREATE VIEW public.v_him_comm_thread
WITH (security_invoker = true) AS
SELECT
  h.id,
  h.tenant_id,
  h.encounter_id,
  h.form_instance_id,
  h.coding_row_id,
  h.direction,
  h.channel,
  h.author,
  p.full_name AS author_name,
  h.body,
  h.payload,
  h.read_at,
  h.read_by,
  h.created_at,
  (h.read_at IS NOT NULL AND h.read_by = auth.uid()) AS is_read_by_me,
  (h.read_at IS NULL) AS unread
FROM public.him_communication h
LEFT JOIN public.profiles p ON p.id = h.author;

GRANT SELECT ON public.v_him_comm_thread TO authenticated;
