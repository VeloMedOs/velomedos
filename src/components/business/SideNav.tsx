import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building2, LayoutDashboard, Radio, Ambulance, PhoneCall, Stethoscope, GraduationCap,
  ClipboardCheck, Wrench, Users, BookOpen, KeyRound, Settings, ChevronsLeft, ChevronsRight,
  Activity, BarChart3, Bell, MessageSquare, Shield,
} from "lucide-react";

type Item = { to?: string; label: string; icon: any; soon?: boolean };
type Group = { id: string; label: string; items: Item[] };

const GROUPS: Group[] = [
  { id: "overview", label: "Command Center", items: [
    { to: "/business", label: "Overview", icon: LayoutDashboard },
  ]},
  { id: "ops", label: "Operations", items: [
    { to: "/dispatch",    label: "Dispatch",     icon: Radio },
    { to: "/fleet",       label: "Fleet",        icon: Ambulance },
    { to: "/call-center", label: "Call center",  icon: PhoneCall },
    { to: "/screening",   label: "Mobile screening", icon: Activity },
  ]},
  { id: "care", label: "Care services", items: [
    { to: "/clinics",   label: "Remote clinics", icon: Stethoscope },
    { to: "/training",  label: "Training & LMS", icon: GraduationCap },
  ]},
  { id: "compliance", label: "Compliance", items: [
    { to: "/compliance", label: "Credentials & SOPs", icon: ClipboardCheck },
    { to: "/maintenance", label: "Maintenance", icon: Wrench, soon: true },
  ]},
  { id: "people", label: "People", items: [
    { to: "/team",  label: "Team & roles", icon: Users, soon: true },
    { label: "Notifications", icon: Bell, soon: true },
    { label: "Messaging", icon: MessageSquare, soon: true },
  ]},
  { id: "insights", label: "Insights", items: [
    { label: "Analytics", icon: BarChart3, soon: true },
  ]},
  { id: "developer", label: "Developer", items: [
    { to: "/developer", label: "API keys", icon: KeyRound },
    { to: "/api-docs",  label: "API docs", icon: BookOpen },
  ]},
  { id: "settings", label: "Settings", items: [
    { label: "Workspace", icon: Settings, soon: true },
    { label: "Security",  icon: Shield, soon: true },
  ]},
];

export function BusinessSideNav({ companyName, planTier, accent }: { companyName?: string | null; planTier?: string | null; accent?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    try {
      const v = localStorage.getItem("velomed.business.nav.collapsed");
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);
  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("velomed.business.nav.collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  }

  const flat = GROUPS.flatMap((g) => g.items);
  const isActive = (to?: string) => !!to && (path === to || (to !== "/business" && path.startsWith(to)));

  return (
    <aside className="sticky top-0 self-start h-screen flex shrink-0 border-r border-hairline bg-panel/60 backdrop-blur z-20">
      <div className="w-14 flex flex-col items-center py-3 gap-1 border-r border-hairline">
        <div className="size-9 grid place-items-center rounded-lg text-background font-bold mb-2" style={{ background: accent ?? "var(--brand-teal, #28D6B6)" }}>
          {(companyName ?? "V")[0]}
        </div>
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-1 px-1 scrollbar-none">
          {flat.map((it, i) => {
            const active = isActive(it.to);
            const Icon = it.icon;
            const cls = `relative size-9 grid place-items-center rounded-lg transition-colors
              ${active ? "bg-teal/15 text-teal" : "text-muted-foreground hover:text-foreground hover:bg-panel-elevated"}
              ${it.soon ? "opacity-40 cursor-not-allowed" : ""}`;
            return it.soon || !it.to ? (
              <button key={`s-${i}-${it.label}`} title={it.label + " · coming soon"} disabled className={cls}><Icon className="size-4" /></button>
            ) : (
              <Link key={it.to} to={it.to} title={it.label} className={cls}>
                {active && <span className="absolute left-[-7px] top-1.5 bottom-1.5 w-[2px] rounded-full bg-teal" />}
                <Icon className="size-4" />
              </Link>
            );
          })}
        </div>
        <button onClick={toggle} title={collapsed ? "Expand nav" : "Collapse nav"} className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-panel-elevated">
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="w-60 hidden lg:flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-hairline">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal flex items-center gap-1.5"><Building2 className="size-3" /> Business workspace</div>
            <div className="text-sm font-semibold mt-0.5 truncate">{companyName ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{planTier ?? "—"} plan</div>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            {GROUPS.map((g) => (
              <div key={g.id}>
                <div className="px-2 mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-1">{g.label}</div>
                <div className="space-y-0.5">
                  {g.items.map((it, i) => {
                    const active = isActive(it.to);
                    const Icon = it.icon;
                    const cls = `group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] transition-colors
                      ${active ? "bg-teal/12 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-panel-elevated"}
                      ${it.soon ? "opacity-50 cursor-not-allowed" : ""}`;
                    return it.soon || !it.to ? (
                      <button key={`s-${g.id}-${i}-${it.label}`} disabled className={cls}>
                        <Icon className="size-3.5" />
                        <span className="flex-1 text-left truncate">{it.label}</span>
                        <span className="mono text-[8.5px] uppercase tracking-widest text-muted-foreground/60">soon</span>
                      </button>
                    ) : (
                      <Link key={it.to} to={it.to} className={cls}>
                        <Icon className={`size-3.5 ${active ? "text-teal" : ""}`} />
                        <span className="flex-1 text-left truncate">{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
}