
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.corporate_accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS api_keys_tenant_id_idx ON public.api_keys(tenant_id);

-- Superadmin: full management of every key
DROP POLICY IF EXISTS "apikeys superadmin all" ON public.api_keys;
CREATE POLICY "apikeys superadmin all" ON public.api_keys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Business admins of a tenant can read & revoke their tenant's keys
DROP POLICY IF EXISTS "apikeys tenant admin read" ON public.api_keys;
CREATE POLICY "apikeys tenant admin read" ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = api_keys.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "apikeys tenant admin delete" ON public.api_keys;
CREATE POLICY "apikeys tenant admin delete" ON public.api_keys
  FOR DELETE TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = api_keys.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
  );
