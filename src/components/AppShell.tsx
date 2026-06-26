import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, LogOut } from "lucide-react";

const NAV = [
  { to: "/admin", label: "Overview" },
  { to: "/fleet", label: "Fleet" },
  { to: "/dispatch", label: "Dispatch" },
  { to: "/provider", label: "Provider" },
  { to: "/patient", label: "Patient" },
  { to: "/rentals", label: "Rentals" },
  { to: "/training", label: "Training" },
  { to: "/compliance", label: "Compliance" },
  { to: "/screening", label: "Screening" },
  { to: "/audit", label: "Audit" },
  { to: "/developer", label: "API Keys" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 h-14 border-b border-hairline bg-panel/95 backdrop-blur flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-emergency grid place-items-center text-emergency-foreground font-bold shadow-[0_0_18px_oklch(0.62_0.22_27/0.5)]">
              <Activity className="size-4" />
            </div>
            <span className="font-bold tracking-tight text-base">
              VELOMED <span className="text-emergency">OS</span>
            </span>
          </Link>
          <div className="hidden md:flex gap-1 mono text-[11px] uppercase tracking-[0.14em]">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md transition-colors ${active ? "bg-panel-elevated text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-panel-elevated mono text-[10px] uppercase tracking-widest text-stable">
            <span className="size-1.5 rounded-full bg-stable shadow-[0_0_8px_oklch(0.7_0.16_155/0.8)] animate-pulse" />
            System Live
          </div>
          <span className="hidden md:inline mono text-[11px] text-muted-foreground truncate max-w-[160px]">{email}</span>
          <button
            onClick={signOut}
            className="size-8 rounded-md bg-panel-elevated hover:bg-accent grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}