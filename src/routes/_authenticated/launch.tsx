import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { resolveDestination, safeNext, type Destination } from "@/lib/launch-destination";
import { ArrowRight, Stethoscope, ShieldCheck, LogOut } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

const TENANT_KEY = "velomed.active_tenant";

export const Route = createFileRoute("/_authenticated/launch")({
  validateSearch: z.object({
    next: z.string().regex(/^\/(?![\/\\])/).optional(),
  }),
  head: () => ({ meta: [{ title: "Launcher · VeloMed OS" }] }),
  component: Launcher,
});

type Tenant = { tenant_id: string; clinical_role: string | null; company: string | null };

function Launcher() {
  const search = useSearch({ from: "/_authenticated/launch" });
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "no_tenant" | "pick_tenant" | "ready">("loading");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [allow, setAllow] = useState<Destination[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      // Platform roles
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const platformRoles = (r ?? []).map((x: { role: string }) => x.role);

      // Superadmin shortcut by email
      const isSuperByEmail = (u.user.email ?? "").toLowerCase() === "superadmin@velomedos.com";
      const effective = isSuperByEmail && !platformRoles.includes("superadmin")
        ? [...platformRoles, "superadmin"]
        : platformRoles;

      // Tenant memberships
      const { data: tm } = await supabase
        .from("tenant_members")
        .select("tenant_id, clinical_role, corporate_accounts:tenant_id(company_name)")
        .eq("user_id", u.user.id);
      const memberships: Tenant[] = (tm ?? []).map((row: any) => ({
        tenant_id: row.tenant_id,
        clinical_role: row.clinical_role,
        company: row.corporate_accounts?.company_name ?? null,
      }));
      setTenants(memberships);
      setRoles(effective);

      // Multi-tenant: honour stored choice, otherwise prompt
      let active: Tenant | null = null;
      if (memberships.length === 1) {
        active = memberships[0];
      } else if (memberships.length > 1) {
        let stored: string | null = null;
        try { stored = localStorage.getItem(TENANT_KEY); } catch { /* noop */ }
        active = memberships.find((m) => m.tenant_id === stored) ?? null;
        if (!active) {
          setStatus("pick_tenant");
          return;
        }
      }
      setActiveTenant(active);

      const hasClinical = !!active?.clinical_role;
      const { dest, allow: list } = resolveDestination(effective, hasClinical, safeNext(search.next));
      setAllow(list);

      if (list.length === 1) {
        navigate({ to: dest, replace: true });
        return;
      }
      // Multi-destination — show launcher cards. If next was honoured, go.
      if (search.next && safeNext(search.next) && list.some((d) => dest === d.path || dest.startsWith(d.path + "/"))) {
        navigate({ to: dest, replace: true });
        return;
      }
      setStatus(list.length === 0 ? "no_tenant" : "ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickTenant(t: Tenant) {
    try { localStorage.setItem(TENANT_KEY, t.tenant_id); } catch { /* noop */ }
    // Re-run the launcher with the active tenant now persisted.
    navigate({ to: "/launch", search: { next: search.next }, replace: true });
    setTimeout(() => window.location.reload(), 0);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/auth");
  }

  if (status === "loading") {
    return <Frame><div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">Resolving your workspace…</div></Frame>;
  }
  if (status === "pick_tenant") {
    return (
      <Frame>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Choose your tenant</h1>
          <p className="text-sm text-muted-foreground">You belong to more than one organisation. Pick the one you'd like to work in now — you can switch later from the sidebar.</p>
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            {tenants.map((t) => (
              <button key={t.tenant_id} onClick={() => pickTenant(t)} className="text-left rounded-xl border border-hairline bg-panel p-4 hover:bg-panel-elevated transition">
                <div className="font-medium">{t.company ?? t.tenant_id.slice(0, 8)}</div>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">role · {t.clinical_role ?? "—"}</div>
              </button>
            ))}
          </div>
        </div>
      </Frame>
    );
  }
  if (status === "no_tenant") {
    return (
      <Frame>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">No workspace assigned</h1>
          <p className="text-sm text-muted-foreground">Your account is signed in but isn't a member of any tenant or platform role. Ask your superadmin to grant access.</p>
          <button onClick={signOut} className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline inline-flex items-center gap-1.5"><LogOut className="size-3" /> Sign out</button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="space-y-6">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal flex items-center gap-2">
            <ShieldCheck className="size-3" /> Launcher · {roles.length} role{roles.length === 1 ? "" : "s"}{activeTenant ? " · 1 tenant" : ""}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Where to next?</h1>
          <p className="text-sm text-muted-foreground mt-1">You have access to multiple workspaces. Pick one to continue.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allow.map((d) => (
            <Link key={d.path} to={d.path} className="group rounded-xl border border-hairline bg-panel p-5 hover:bg-panel-elevated transition flex flex-col gap-3">
              <div className="size-9 rounded-lg grid place-items-center bg-teal/15 text-teal"><Stethoscope className="size-4" /></div>
              <div>
                <div className="font-medium">{d.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{d.blurb}</div>
              </div>
              <div className="mono text-[10px] uppercase tracking-widest text-action inline-flex items-center gap-1 group-hover:gap-2 transition-all">Open <ArrowRight className="size-3" /></div>
            </Link>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-7" />
          <BrandWordmark />
        </div>
        {children}
      </div>
    </div>
  );
}