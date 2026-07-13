import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, LogOut, Calendar } from "lucide-react";

/**
 * Sticky DEMO / SANDBOX banner. Renders only when the signed-in user belongs
 * to a tenant tagged `tenant_type = 'sandbox'` (Round 1 replaces the legacy
 * `is_demo` flag with the new `tenant_type` enum on `corporate_accounts`).
 */
export function DemoBanner() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("tenant_members")
        .select("tenant_id, corporate_accounts(tenant_type)")
        .eq("user_id", user.id);
      if (cancelled) return;
      const any = (data ?? []).some(
        (r: { corporate_accounts?: { tenant_type?: string } | null }) =>
          r?.corporate_accounts?.tenant_type === "sandbox",
      );
      setShow(any);
    })();
    return () => { cancelled = true; };
  }, []);

  async function exitDemo() {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    navigate({ to: "/", replace: true });
  }

  function bookDemo() {
    navigate({ to: "/", search: { intake: "1" } as never });
  }

  if (!show) return null;
  return (
    <div
      role="status"
      className="sticky top-14 z-40 flex items-center justify-center gap-3 px-3 py-1.5 bg-caution/20 text-caution border-b border-caution/40 mono text-[10.5px] uppercase tracking-[0.22em]"
    >
      <ShieldAlert className="size-3.5" />
      <span>Demo · Sandbox tenant · No real PHI, no live NPHIES / ZATCA / D365 calls</span>
      <button
        onClick={bookDemo}
        data-testid="demo-banner-book"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-caution/60 hover:bg-caution/10"
      >
        <Calendar className="size-3" /> Book a real demo
      </button>
      <button
        onClick={exitDemo}
        data-testid="demo-banner-exit"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-caution/60 hover:bg-caution/10"
      >
        <LogOut className="size-3" /> Exit demo
      </button>
    </div>
  );
}