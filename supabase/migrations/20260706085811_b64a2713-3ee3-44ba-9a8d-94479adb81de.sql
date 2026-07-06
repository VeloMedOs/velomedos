-- Recreate v_order_item_gate with security_invoker to respect caller's RLS.
ALTER VIEW public.v_order_item_gate SET (security_invoker = true);