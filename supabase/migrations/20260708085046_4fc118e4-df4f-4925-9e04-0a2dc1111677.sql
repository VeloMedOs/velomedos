CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  display_name text NOT NULL,
  specialty text,
  seniority_rank int,
  auth_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers tenant read"  ON public.providers FOR SELECT
  TO authenticated USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "providers tenant write" ON public.providers FOR ALL
  TO authenticated USING (public.is_tenant_admin(auth.uid(), tenant_id))
                   WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "providers service" ON public.providers FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS providers_tenant_idx ON public.providers(tenant_id);

-- Best-effort backfill from clinic_schedule.provider_id + profiles.full_name.
INSERT INTO public.providers (id, tenant_id, display_name, auth_user_id)
SELECT DISTINCT cs.provider_id, cs.tenant_id,
       COALESCE(pr.full_name, 'Provider ' || substr(cs.provider_id::text, 1, 6)),
       pr.id
  FROM public.clinic_schedule cs
  LEFT JOIN public.profiles pr ON pr.id = cs.provider_id
 WHERE cs.provider_id IS NOT NULL AND cs.tenant_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Add specialty column to clinic_schedule (single specialty per session, locked-rule walk-in filter).
ALTER TABLE public.clinic_schedule ADD COLUMN IF NOT EXISTS specialty text NULL;
COMMENT ON COLUMN public.clinic_schedule.specialty IS
  'Single specialty per session (locked-rule walk-in lane filter, file 13 §C).';