-- Step 5 Turn 1 · health_cluster + corporate_accounts.cluster_id
CREATE TABLE IF NOT EXISTS public.health_cluster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.health_cluster TO authenticated;
GRANT ALL ON public.health_cluster TO service_role;

-- Add FK column first so the policy below can reference it.
ALTER TABLE public.corporate_accounts
  ADD COLUMN IF NOT EXISTS cluster_id uuid NULL REFERENCES public.health_cluster(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS corporate_accounts_cluster_idx
  ON public.corporate_accounts(cluster_id)
  WHERE cluster_id IS NOT NULL;

ALTER TABLE public.health_cluster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_cluster_read_member ON public.health_cluster;
CREATE POLICY health_cluster_read_member ON public.health_cluster
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT ca.cluster_id
      FROM public.corporate_accounts ca
      JOIN public.tenant_members tm ON tm.tenant_id = ca.id
      WHERE tm.user_id = auth.uid() AND ca.cluster_id IS NOT NULL
    )
  );