import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, LogOut, Shield } from "lucide-react";

const VELOMED_NAV = [
  { to: "/superadmin", label: "Superadmin" },
  { to: "/admin", label: "Overview" },
  { to: "/fleet", label: "Fleet" },
  { to: "/dispatch", label: "Dispatch" },
  { to: "/call-center", label: "Call Center" },
  { to: "/trips", label: "Trips" },
  { to: "/provider", label: "Provider" },
  { to: "/patient", label: "Patient" },
  { to: "/rentals", label: "Rentals" },
  { to: "/training", label: "Training" },
  { to: "/compliance", label: "Compliance" },
  { to: "/screening", label: "Screening" },
  { to: "/audit", label: "Audit" },
  { to: "/developer", label: "API Keys" },
] as const;

const BUSINESS_NAV = [
  { to: "/business", label: "Workspace" },
  { to: "/dispatch", label: "Dispatch" },
  { to: "/fleet", label: "Fleet" },
  { to: "/call-center", label: "Call Center" },
  { to: "/trips", label: "Trips" },
  { to: "/compliance", label: "Compliance" },
  { to: "/screening", label: "Screening" },
  { to: "/training", label: "Training" },
] as const;

const PATIENT_NAV = [
  { to: "/patient", label: "My care" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (!data.user) return;
      const { data: rs } = await (supabase as any).rpc("get_user_roles", { _user_id: data.user.id });
      setRoles((rs ?? []).map((r: any) => (typeof r === "string" ? r : r.role)));
    });
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isSuper = roles.includes("superadmin");
  const isBiz = roles.includes("business_admin");
  const isVeloStaff = isSuper || roles.includes("admin") || roles.includes("dispatcher") || roles.includes("developer");
  const NAV = isVeloStaff ? VELOMED_NAV.filter((n) => n.to !== "/superadmin" || isSuper) : isBiz ? BUSINESS_NAV : PATIENT_NAV;

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
              const isSuperLink = n.to === "/superadmin";
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${active ? "bg-panel-elevated text-foreground" : "text-muted-foreground hover:text-foreground"} ${isSuperLink ? "text-emergency hover:text-emergency" : ""}`}
                >
                  {isSuperLink && <Shield className="size-3" />}
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSuper && (
            <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded mono text-[9px] uppercase tracking-widest bg-emergency/15 text-emergency border border-emergency/30">
              <Shield className="size-3" /> Superadmin
            </span>
          )}
          {isBiz && !isSuper && (
            <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded mono text-[9px] uppercase tracking-widest bg-action/15 text-action border border-action/30">
              Business
            </span>
          )}
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