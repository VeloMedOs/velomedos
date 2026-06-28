import { useEffect, useState } from "react";
import {
  Shield, LayoutDashboard, Building2, Webhook, CreditCard, Package, RefreshCw,
  UserCog, Lock, KeyRound, BookOpen, Bug, ChevronsLeft, ChevronsRight,
  LifeBuoy, MessageSquare, Star, Bell, Globe, FileText, Search, Newspaper,
  FolderOpen, Image as ImageIcon, FlaskConical, ListChecks, ShieldCheck,
  GitBranch, Zap, Settings, Users,
} from "lucide-react";

export type SuperTabId =
  | "overview" | "tenants" | "subs" | "plans" | "roles" | "apikeys"
  | "privileges" | "apidocs" | "requests" | "debug";

type Item = {
  id: SuperTabId | `soon:${string}`;
  label: string;
  icon: any;
  badge?: number;
  soon?: boolean;
};

type Group = { id: string; label: string; items: Item[] };

export function SuperadminSideNav({
  tab, setTab, badges,
}: {
  tab: SuperTabId;
  setTab: (t: SuperTabId) => void;
  badges: { subs?: number; requests?: number; apiKeys?: number };
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem("velomed.superadmin.nav.collapsed");
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);
  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("velomed.superadmin.nav.collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  }

  const groups: Group[] = [
    { id: "command", label: "Command Center", items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
    ]},
    { id: "accounts", label: "Accounts", items: [
      { id: "tenants",  label: "Tenants",  icon: Building2 },
      { id: "requests", label: "Requests", icon: Webhook, badge: badges.requests },
    ]},
    { id: "revenue", label: "Revenue", items: [
      { id: "subs",  label: "Subscriptions", icon: CreditCard, badge: badges.subs },
      { id: "plans", label: "Plans",         icon: Package },
      { id: "soon:refunds", label: "Refunds", icon: RefreshCw, soon: true },
    ]},
    { id: "access", label: "Access", items: [
      { id: "roles",      label: "Roles & access", icon: UserCog },
      { id: "privileges", label: "Privileges",     icon: Lock },
      { id: "apikeys",    label: "API keys",       icon: KeyRound, badge: badges.apiKeys },
    ]},
    { id: "developer", label: "Developer", items: [
      { id: "apidocs", label: "API docs", icon: BookOpen },
      { id: "debug",   label: "Debug",    icon: Bug },
    ]},
    { id: "support", label: "Support", items: [
      { id: "soon:tickets",  label: "Tickets",       icon: LifeBuoy, soon: true },
      { id: "soon:reviews",  label: "Reviews",       icon: Star, soon: true },
      { id: "soon:chat",     label: "Chat & filter", icon: MessageSquare, soon: true },
      { id: "soon:push",     label: "Push notifications", icon: Bell, soon: true },
    ]},
    { id: "cms", label: "Website CMS", items: [
      { id: "soon:pages",   label: "Pages & sections", icon: FileText, soon: true },
      { id: "soon:seo",     label: "SEO manager",      icon: Search, soon: true },
      { id: "soon:news",    label: "News & articles",  icon: Newspaper, soon: true },
      { id: "soon:blogcat", label: "Blog categories",  icon: FolderOpen, soon: true },
      { id: "soon:media",   label: "Media library",    icon: ImageIcon, soon: true },
    ]},
    { id: "qa", label: "Quality Control", items: [
      { id: "soon:tests",     label: "Test runs",       icon: FlaskConical, soon: true },
      { id: "soon:audit",     label: "Audit log",       icon: ListChecks, soon: true },
      { id: "soon:smoke",     label: "Smoke reports",   icon: ShieldCheck, soon: true },
      { id: "soon:bugs",      label: "Bug tracker",     icon: Bug, soon: true },
      { id: "soon:releases",  label: "Releases",        icon: GitBranch, soon: true },
      { id: "soon:automation",label: "Automated events",icon: Zap, soon: true },
    ]},
    { id: "settings", label: "Settings", items: [
      { id: "soon:workspace", label: "Workspace", icon: Settings, soon: true },
      { id: "soon:team",      label: "Team & roles", icon: Users, soon: true },
      { id: "soon:security",  label: "Security", icon: Shield, soon: true },
    ]},
  ];

  const flat: Item[] = groups.flatMap((g) => g.items);

  function onClick(it: Item) {
    if (it.soon) return;
    setTab(it.id as SuperTabId);
  }

  return (
    <aside className="sticky top-0 self-start h-screen flex shrink-0 border-r border-hairline bg-panel/60 backdrop-blur z-20">
      {/* Icon rail */}
      <div className="w-14 flex flex-col items-center py-3 gap-1 border-r border-hairline">
        <div className="size-9 grid place-items-center rounded-lg bg-teal/15 text-teal mb-2">
          <Shield className="size-4" />
        </div>
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-1 px-1 scrollbar-none">
          {flat.map((it) => {
            const active = !it.soon && tab === it.id;
            const Icon = it.icon;
            return (
              <button
                key={it.id}
                onClick={() => onClick(it)}
                title={it.label + (it.soon ? " · coming soon" : "")}
                disabled={it.soon}
                className={`relative size-9 grid place-items-center rounded-lg transition-colors
                  ${active ? "bg-teal/15 text-teal" : "text-muted-foreground hover:text-foreground hover:bg-panel-elevated"}
                  ${it.soon ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {active && <span className="absolute left-[-7px] top-1.5 bottom-1.5 w-[2px] rounded-full bg-teal" />}
                <Icon className="size-4" />
                {it.badge ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-caution text-[9px] text-background grid place-items-center mono">
                    {it.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          onClick={toggle}
          title={collapsed ? "Expand nav" : "Collapse nav"}
          className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-panel-elevated"
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>

      {/* Label panel */}
      {!collapsed && (
        <div className="w-60 hidden lg:flex flex-col">
          <div className="px-4 pt-4 pb-3 border-b border-hairline">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal">VeloMed Superadmin</div>
            <div className="text-sm font-semibold mt-0.5">Control plane</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Tenants · billing · access</div>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            {groups.map((g) => (
              <div key={g.id}>
                <div className="px-2 mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/70 mb-1">
                  {g.label}
                </div>
                <div className="space-y-0.5">
                  {g.items.map((it) => {
                    const active = !it.soon && tab === it.id;
                    const Icon = it.icon;
                    return (
                      <button
                        key={it.id}
                        onClick={() => onClick(it)}
                        disabled={it.soon}
                        className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] transition-colors
                          ${active
                            ? "bg-teal/12 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-panel-elevated"}
                          ${it.soon ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {active && <span className="size-1.5 rounded-full bg-teal absolute" style={{ marginLeft: -10 }} />}
                        <Icon className={`size-3.5 ${active ? "text-teal" : ""}`} />
                        <span className="flex-1 text-left truncate">{it.label}</span>
                        {it.badge ? (
                          <span className="px-1.5 py-0.5 rounded bg-caution/20 text-caution text-[9px] mono">
                            {it.badge}
                          </span>
                        ) : null}
                        {it.soon ? (
                          <span className="mono text-[8.5px] uppercase tracking-widest text-muted-foreground/60">soon</span>
                        ) : null}
                      </button>
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