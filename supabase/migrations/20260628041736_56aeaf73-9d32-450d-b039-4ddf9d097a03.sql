
CREATE TABLE public.debug_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.corporate_accounts(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('overlay','console','playwright','api','manual')),
  kind text NOT NULL CHECK (kind IN ('glitch','snapshot','metric','error','info')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error','critical')),
  route text,
  viewport text,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX debug_events_tenant_idx ON public.debug_events(tenant_id, created_at DESC);
CREATE INDEX debug_events_kind_idx ON public.debug_events(kind, severity, created_at DESC);

GRANT SELECT, INSERT ON public.debug_events TO authenticated;
GRANT ALL ON public.debug_events TO service_role;

ALTER TABLE public.debug_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin reads all debug events"
  ON public.debug_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "tenant admins read own debug events"
  ON public.debug_events FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = debug_events.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('admin','owner')
    )
  );

CREATE POLICY "authenticated users submit debug events"
  ON public.debug_events FOR INSERT TO authenticated
  WITH CHECK (created_by IS NULL OR created_by = auth.uid());
