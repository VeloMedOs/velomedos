import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setState(data.user ? "in" : "out");
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (state === "out") {
      window.location.replace("/auth");
    }
  }, [state]);

  if (state !== "in") {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground mono text-[11px] uppercase tracking-widest">
        <div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-action animate-pulse" /> Authenticating…</div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}