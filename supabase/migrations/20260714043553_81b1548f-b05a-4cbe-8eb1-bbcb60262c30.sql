
-- Tighten SELECT policy on subscription_plans for authenticated users
DROP POLICY IF EXISTS "plans readable by signed-in users" ON public.subscription_plans;
CREATE POLICY "plans readable by signed-in users"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (is_public = true AND is_active = true);

-- Tighten SELECT policy on pricing_rule: remove null-tenant global read
DROP POLICY IF EXISTS "pricing_rule read" ON public.pricing_rule;
CREATE POLICY "pricing_rule read"
ON public.pricing_rule
FOR SELECT
TO authenticated
USING (tenant_id IS NOT NULL AND is_tenant_member(auth.uid(), tenant_id));

-- Revoke EXECUTE on SECURITY DEFINER helpers that should only be called via
-- service_role (server-side) or via triggers — not directly by anon/authenticated
REVOKE EXECUTE ON FUNCTION public.is_sandbox_tenant(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preauth_mid_board(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_maternity_protocol(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_vaccine_clinic(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_gate_open(uuid, uuid) FROM anon, authenticated;
