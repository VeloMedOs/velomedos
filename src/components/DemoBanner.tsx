import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";

/**
 * Sticky DEMO / SANDBOX banner. Renders only when the signed-in user belongs
 * to a tenant with `is_demo = true`.
 */
export function DemoBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("tenant_members")
        .select("tenant_id, corporate_accounts(is_demo)")
        .eq("user_id", user.id);
      if (cancelled) return;
      const any = (data ?? []).some(
        (r: { corporate_accounts?: { is_demo?: boolean } | null }) =>
          r?.corporate_accounts?.is_demo === true,
      );
      setShow(any);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;
  return (
    <div
      role="status"
      className="sticky top-14 z-40 flex items-center justify-center gap-2 px-3 py-1.5 bg-caution/20 text-caution border-b border-caution/40 mono text-[10.5px] uppercase tracking-[0.22em]"
    >
      <ShieldAlert className="size-3.5" />
      Demo · Sandbox tenant · No real PHI, no live NPHIES / ZATCA / D365 calls
    </div>
  );
}