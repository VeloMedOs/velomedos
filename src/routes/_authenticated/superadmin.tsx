import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, Building2, Activity, KeyRound, Webhook, Users, Server,
  CheckCircle2, XCircle, CreditCard, Package, UserCog, LayoutDashboard,
  Plus, Trash2, Search, BadgeCheck, Pause, Play, RefreshCw, Copy, BookOpen, Lock, Bug, Fingerprint, AlertTriangle,
} from "lucide-react";
import { openApiSpec } from "@/lib/openapi-spec";
import { openApiAdminSpec, adminEndpointCount } from "@/lib/openapi-admin-spec";
import { ROLE_META, ROLE_ORDER, CAPABILITIES, effectiveCapabilities, type AppRole } from "@/lib/role-matrix";

export const Route = createFileRoute("/_authenticated/superadmin")({
  head: () => ({ meta: [{ title: "Superadmin · VeloMed OS" }] }),
  component: Superadmin,
});

type Tenant = { id: string; company_name: string; slug: string | null; logo_url: string | null; status: string; plan_tier: string; country: string | null; created_at: string };
type Req = { id: string; company_name: string; contact_name: string; contact_email: string; contact_phone: string | null; country: string | null; fleet_size: number | null; use_case: string | null; status: string; created_at: string };
type Plan = { id: string; code: string; name: string; description: string | null; price_cents: number; currency: string; billing_period: string; included_seats: number; features: string[]; is_active: boolean; sort_order: number };
type Sub = { id: string; tenant_id: string; plan_id: string; status: string; seats: number; current_period_start: string; current_period_end: string | null; cancel_at_period_end: boolean; notes: string | null };
type Profile = { id: string; full_name: string | null; email: string | null; default_role: string | null };
type RoleRow = { user_id: string; role: string };
type ApiKey = { id: string; name: string; prefix: string; scopes: string[]; rate_limit_per_min: number; tenant_id: string | null; owner_id: string; created_at: string; last_used_at: string | null };

type Identity = {
  authed: boolean;
  userId: string | null;
  email: string | null;
  emailVerified: boolean;
  provider: string | null;
  roles: string[];
  rolesError: string | null;
  tenants: { tenant_id: string; role: string; company_name: string | null; slug: string | null }[];
  ownedApiKeys: number;
  fetchedAt: string;
  lookupUserId: string | null;
  roleHits: { role: string; source: "user_roles" | "portal_role_assignments" | "tenant_members"; tenant_id?: string | null }[];
  roleErrors: { user_roles: string | null; portal_role_assignments: string | null; tenant_members: string | null };
  diagnosticCode: string;
  source: "api" | "fallback";
  requestId: string | null;
};

const ALL_ROLES = ["superadmin","admin","dispatcher","developer","business_admin","paramedic","driver","patient"] as const;
const ALL_SCOPES = ["fleet:read","incidents:read","incidents:write","clinics:read","courses:read","compliance:read","screening:read","screening:write","debug:read","debug:write"] as const;
const STATUS_COLORS: Record<string, string> = {
  trialing:   "bg-action/20 text-action",
  active:     "bg-stable/20 text-stable",
  past_due:   "bg-caution/20 text-caution",
  cancelled:  "bg-muted text-muted-foreground",
  suspended:  "bg-emergency/20 text-emergency",
};
const fmtMoney = (c: number, cur: string) =>
  c === 0 ? "Custom" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(c / 100);

type TabId = "overview" | "tenants" | "subs" | "plans" | "roles" | "apikeys" | "privileges" | "apidocs" | "requests" | "debug";

function Superadmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState({ users: 0, incidents: 0, ambulances: 0, apiKeys: 0, webhooks: 0 });

  async function diagnose(): Promise<Identity> {
    // Prefer the dedicated diagnostics endpoint so the UI stays in sync with
    // the same role-resolution logic the API uses. Fall back to a direct
    // read against `user_roles` only if the endpoint is unreachable.
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    try {
      const res = await fetch("/api/admin/v1/diagnostics/superadmin", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const j = await res.json();
        const id: Identity = {
          authed: !!j.authed,
          userId: j.user_id ?? null,
          email: j.email ?? null,
          emailVerified: !!j.email_verified,
          provider: j.provider ?? null,
          roles: (j.resolved_roles ?? []) as string[],
          rolesError: j.role_errors?.user_roles ?? null,
          tenants: (j.tenants ?? []) as Identity["tenants"],
          ownedApiKeys: j.owned_api_keys ?? 0,
          fetchedAt: j.fetched_at ?? new Date().toISOString(),
          lookupUserId: j.lookup_user_id ?? null,
          roleHits: (j.roles ?? []) as Identity["roleHits"],
          roleErrors: j.role_errors ?? { user_roles: null, portal_role_assignments: null, tenant_members: null },
          diagnosticCode: j.code ?? "UNKNOWN",
          source: "api",
          requestId: j.request_id ?? null,
        };
        setIdentity(id);
        setAllowed(id.roles.includes("superadmin"));
        return id;
      }
    } catch { /* fall through to fallback */ }

    // Fallback path — direct DB read.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const id: Identity = {
        authed: false, userId: null, email: null, emailVerified: false, provider: null,
        roles: [], rolesError: null, tenants: [], ownedApiKeys: 0, fetchedAt: new Date().toISOString(),
        lookupUserId: null, roleHits: [],
        roleErrors: { user_roles: null, portal_role_assignments: null, tenant_members: null },
        diagnosticCode: "AUTH_MISSING", source: "fallback", requestId: null,
      };
      setIdentity(id); setAllowed(false); return id;
    }
    const [{ data: roleRows, error: rolesErr }, { data: memberRows }, { count: keyCount }] = await Promise.all([
      (supabase as any).from("user_roles").select("role").eq("user_id", user.id),
      (supabase as any).from("tenant_members")
        .select("tenant_id, role, corporate_accounts(company_name, slug)")
        .eq("user_id", user.id),
      (supabase as any).from("api_keys").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    ]);
    const roles: string[] = (roleRows ?? []).map((r: any) => r.role);
    const hits: Identity["roleHits"] = [
      ...((roleRows ?? []) as any[]).map((r) => ({ role: r.role as string, source: "user_roles" as const })),
      ...((memberRows ?? []) as any[]).map((m) => ({ role: m.role as string, source: "tenant_members" as const, tenant_id: m.tenant_id as string })),
    ];
    const id: Identity = {
      authed: true,
      userId: user.id,
      email: user.email ?? null,
      emailVerified: !!user.email_confirmed_at,
      provider: (user.app_metadata as any)?.provider ?? null,
      roles,
      rolesError: rolesErr?.message ?? null,
      tenants: (memberRows ?? []).map((m: any) => ({
        tenant_id: m.tenant_id, role: m.role,
        company_name: m.corporate_accounts?.company_name ?? null,
        slug: m.corporate_accounts?.slug ?? null,
      })),
      ownedApiKeys: keyCount ?? 0,
      fetchedAt: new Date().toISOString(),
      lookupUserId: user.id,
      roleHits: hits,
      roleErrors: { user_roles: rolesErr?.message ?? null, portal_role_assignments: null, tenant_members: null },
      diagnosticCode: roles.includes("superadmin") ? "OK" : (roles.length === 0 ? "NO_ROLES_ASSIGNED" : "ROLE_INSUFFICIENT"),
      source: "fallback",
      requestId: null,
    };
    setIdentity(id);
    setAllowed(roles.includes("superadmin"));
    return id;
  }

  useEffect(() => { diagnose(); }, []);

  async function load() {
    const [t, r, p, s, pr, ur, keys, prof, inc, amb, ak, wh] = await Promise.all([
      (supabase as any).from("corporate_accounts").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("business_requests").select("*").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("subscription_plans").select("*").order("sort_order"),
      (supabase as any).from("tenant_subscriptions").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("profiles").select("id,full_name,email,default_role").order("created_at", { ascending: false }).limit(500),
      (supabase as any).from("user_roles").select("user_id, role"),
      (supabase as any).from("api_keys").select("id,name,prefix,scopes,rate_limit_per_min,tenant_id,owner_id,created_at,last_used_at").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("incidents").select("id", { count: "exact", head: true }),
      supabase.from("ambulances").select("id", { count: "exact", head: true }),
      supabase.from("api_keys").select("id", { count: "exact", head: true }),
      (supabase as any).from("webhook_subscriptions").select("id", { count: "exact", head: true }),
    ]);
    setTenants((t.data ?? []) as Tenant[]);
    setReqs((r.data ?? []) as Req[]);
    setPlans(((p.data ?? []) as any[]).map((x) => ({ ...x, features: Array.isArray(x.features) ? x.features : [] })));
    setSubs((s.data ?? []) as Sub[]);
    setProfiles((pr.data ?? []) as Profile[]);
    setRoles((ur.data ?? []) as RoleRow[]);
    setApiKeys((keys.data ?? []) as ApiKey[]);
    setStats({
      users: prof.count ?? 0,
      incidents: inc.count ?? 0,
      ambulances: amb.count ?? 0,
      apiKeys: ak.count ?? 0,
      webhooks: wh.count ?? 0,
    });
  }
  useEffect(() => { if (allowed) load(); }, [allowed]);

  async function review(id: string, status: "approved" | "rejected") {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("business_requests").update({
      status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Request ${status}`);
    load();
  }

  async function toggleStatus(t: Tenant) {
    const next = t.status === "active" ? "suspended" : "active";
    const { error } = await (supabase as any).from("corporate_accounts").update({ status: next }).eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  }

  // ---------- Subscription mutations ----------
  async function assignPlan(tenantId: string, planId: string, seats: number) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    // cancel any existing active sub
    await (supabase as any).from("tenant_subscriptions")
      .update({ status: "cancelled", cancel_at_period_end: false })
      .eq("tenant_id", tenantId)
      .in("status", ["trialing","active","past_due"]);
    const periodEnd = plan.billing_period === "yearly"
      ? new Date(Date.now() + 365 * 864e5)
      : plan.billing_period === "monthly"
      ? new Date(Date.now() + 30 * 864e5)
      : null;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("tenant_subscriptions").insert({
      tenant_id: tenantId, plan_id: planId, status: "active",
      seats, current_period_start: new Date().toISOString(),
      current_period_end: periodEnd?.toISOString() ?? null,
      assigned_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success(`${plan.name} assigned`);
    load();
  }
  async function changeSubStatus(subId: string, status: string) {
    const { error } = await (supabase as any).from("tenant_subscriptions").update({ status }).eq("id", subId);
    if (error) return toast.error(error.message);
    toast.success(`Subscription ${status}`);
    load();
  }
  async function updateSubSeats(subId: string, seats: number) {
    const { error } = await (supabase as any).from("tenant_subscriptions").update({ seats }).eq("id", subId);
    if (error) return toast.error(error.message);
    load();
  }

  // ---------- Plan mutations ----------
  async function togglePlan(id: string, is_active: boolean) {
    const { error } = await (supabase as any).from("subscription_plans").update({ is_active: !is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  // ---------- Role mutations ----------
  async function grantRole(userId: string, role: string) {
    const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role });
    if (error && !String(error.message).includes("duplicate")) return toast.error(error.message);
    toast.success(`Granted ${role}`);
    load();
  }
  async function revokeRole(userId: string, role: string) {
    const { error } = await (supabase as any).from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) return toast.error(error.message);
    toast.success(`Revoked ${role}`);
    load();
  }

  // ---------- API key mutations ----------
  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? Requests using it will fail immediately.")) return;
    const { error } = await (supabase as any).from("api_keys").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Key revoked");
    load();
  }

  if (allowed === null) return <div className="p-10 mono text-xs text-muted-foreground">Verifying…</div>;
  if (!allowed) return <AccessDenied identity={identity} refresh={diagnose} />;

  const newReqs = reqs.filter((r) => r.status === "new").length;
  const activeSubs = subs.filter((s) => ["trialing","active","past_due"].includes(s.status));
  const mrrCents = activeSubs.reduce((acc, s) => {
    const p = plans.find((pp) => pp.id === s.plan_id);
    if (!p) return acc;
    if (p.billing_period === "monthly") return acc + p.price_cents;
    if (p.billing_period === "yearly")  return acc + Math.round(p.price_cents / 12);
    return acc;
  }, 0);

  const TABS: { id: TabId; label: string; icon: any; badge?: number }[] = [
    { id: "overview", label: "Overview",      icon: LayoutDashboard },
    { id: "tenants",  label: "Tenants",       icon: Building2 },
    { id: "subs",     label: "Subscriptions", icon: CreditCard, badge: activeSubs.length },
    { id: "plans",    label: "Plans",         icon: Package },
    { id: "roles",    label: "Roles & access",icon: UserCog },
    { id: "apikeys",  label: "API keys",      icon: KeyRound, badge: apiKeys.length || undefined },
    { id: "privileges",label:"Privileges",    icon: Lock },
    { id: "apidocs",  label: "API docs",      icon: BookOpen },
    { id: "requests", label: "Requests",      icon: Webhook, badge: newReqs || undefined },
    { id: "debug",    label: "Debug",         icon: Bug },
  ];

  return (
    <main className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-emergency flex items-center gap-2"><Shield className="size-3" /> VeloMed Superadmin</div>
          <h1 className="text-2xl font-bold tracking-tight">Platform control plane</h1>
          <div className="text-xs text-muted-foreground mt-1">Tenants · subscriptions · roles · pipeline</div>
        </div>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emergency animate-pulse" /> Global · all tenants
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {[
          { label: "Tenants", value: tenants.length, icon: Building2 },
          { label: "Active subs", value: activeSubs.length, icon: CreditCard, accent: "text-stable" },
          { label: "MRR", value: fmtMoney(mrrCents, "USD"), icon: BadgeCheck, accent: "text-action" },
          { label: "New requests", value: newReqs, icon: Webhook, accent: newReqs > 0 ? "text-caution" : "" },
          { label: "Users", value: stats.users, icon: Users },
          { label: "API keys", value: stats.apiKeys, icon: KeyRound },
        ].map((c) => (
          <div key={c.label} className="bg-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{c.label}</div>
              <c.icon className={`size-4 ${(c as any).accent ?? "text-action"}`} />
            </div>
            <div className="text-2xl font-bold mono">{c.value}</div>
          </div>
        ))}
      </section>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-hairline">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 mono text-[11px] uppercase tracking-widest border-b-2 transition-colors ${active ? "border-emergency text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="size-3.5" />{t.label}
              {t.badge ? <span className="ml-1 px-1.5 py-0.5 rounded bg-caution/20 text-caution text-[9px]">{t.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <OverviewPane stats={stats} subs={subs} plans={plans} tenants={tenants} reqs={reqs} />
      )}
      {tab === "tenants" && (
        <TenantsPane tenants={tenants} subs={subs} plans={plans} toggleStatus={toggleStatus} assignPlan={assignPlan} />
      )}
      {tab === "subs" && (
        <SubsPane subs={subs} plans={plans} tenants={tenants} changeStatus={changeSubStatus} updateSeats={updateSubSeats} />
      )}
      {tab === "plans" && (
        <PlansPane plans={plans} togglePlan={togglePlan} subs={subs} />
      )}
      {tab === "roles" && (
        <RolesPane profiles={profiles} roles={roles} grantRole={grantRole} revokeRole={revokeRole} />
      )}
      {tab === "apikeys" && (
        <ApiKeysPane keys={apiKeys} tenants={tenants} profiles={profiles} revoke={revokeKey} reload={load} />
      )}
      {tab === "privileges" && (
        <PrivilegesPane profiles={profiles} roles={roles} />
      )}
      {tab === "apidocs" && (
        <ApiDocsPane />
      )}
      {tab === "requests" && (
        <RequestsPane reqs={reqs} review={review} />
      )}
      {tab === "debug" && (
        <DebugPane tenants={tenants} />
      )}

      {identity && <IdentityPanel identity={identity} refresh={diagnose} />}

      <section className="rounded-xl border border-hairline bg-panel p-4">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Quick links</div>
        <div className="flex flex-wrap gap-2">
          {[
            ["/developer", "API keys & scopes"],
            ["/privileges", "Role privileges matrix"],
            ["/api-docs", "OpenAPI / Swagger"],
            ["/audit", "Audit log"],
            ["/admin", "Operations overview"],
            ["/compliance", "Compliance"],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated">{label} →</Link>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ============================== Panes ============================== */

function IdentityPanel({ identity, refresh }: { identity: Identity; refresh: () => Promise<Identity> }) {
  const [open, setOpen] = useState(true);
  const copy = (v: string) => { navigator.clipboard?.writeText(v); toast.success("Copied"); };
  const isSuper = identity.roles.includes("superadmin");
  return (
    <section className="rounded-xl border border-hairline bg-panel overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full px-4 py-2.5 border-b border-hairline mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between hover:bg-panel-elevated">
        <span className="flex items-center gap-2"><Fingerprint className="size-3.5 text-action" /> Identity debug · superadmin-only</span>
        <span className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${isSuper ? "bg-stable" : "bg-emergency"}`} />
          {isSuper ? "superadmin" : "no role"}
        </span>
      </button>
      {open && (
        <div className="p-4 grid md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <Row label="user_id" value={identity.userId ?? "—"} onCopy={identity.userId ? () => copy(identity.userId!) : undefined} mono />
            <Row label="email" value={identity.email ?? "—"} />
            <Row label="email_verified" value={identity.emailVerified ? "yes" : "no"} accent={identity.emailVerified ? "text-stable" : "text-caution"} />
            <Row label="auth_provider" value={identity.provider ?? "—"} />
            <Row label="fetched_at" value={new Date(identity.fetchedAt).toLocaleString()} />
          </div>
          <div className="space-y-2">
            <div>
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">resolved roles ({identity.roles.length})</div>
              <div className="flex flex-wrap gap-1">
                {identity.roles.length === 0 && <span className="mono text-[10px] text-emergency">none</span>}
                {identity.roles.map((r) => (
                  <span key={r} className={`mono text-[10px] uppercase px-2 py-0.5 rounded ${r === "superadmin" ? "bg-emergency/20 text-emergency" : "bg-panel-elevated text-foreground"}`}>{r}</span>
                ))}
              </div>
              {identity.rolesError && <div className="mono text-[10px] text-emergency mt-1">role lookup error: {identity.rolesError}</div>}
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">tenants ({identity.tenants.length})</div>
              {identity.tenants.length === 0 && <span className="mono text-[10px] text-muted-foreground">no tenant memberships</span>}
              <div className="space-y-1">
                {identity.tenants.map((t) => (
                  <div key={t.tenant_id} className="flex items-center justify-between gap-2 border border-hairline rounded px-2 py-1">
                    <span className="truncate">{t.company_name ?? t.slug ?? t.tenant_id}</span>
                    <span className="mono text-[10px] text-action uppercase">{t.role}</span>
                  </div>
                ))}
              </div>
            </div>
            <Row label="owned_api_keys" value={String(identity.ownedApiKeys)} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button onClick={() => refresh()} className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated flex items-center gap-1.5">
              <RefreshCw className="size-3" /> Re-run diagnostic
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value, accent, mono, onCopy }: { label: string; value: string; accent?: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-hairline/60 pb-1">
      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-2 ${mono ? "mono text-[11px]" : "text-xs"} ${accent ?? "text-foreground"}`}>
        <span className="truncate max-w-[260px]">{value}</span>
        {onCopy && <button onClick={onCopy} className="text-muted-foreground hover:text-foreground"><Copy className="size-3" /></button>}
      </span>
    </div>
  );
}

function AccessDenied({ identity, refresh }: { identity: Identity | null; refresh: () => Promise<Identity> }) {
  const notAuthed = !identity?.authed;
  const hasRolesButNotSuper = !!identity?.authed && identity!.roles.length > 0 && !identity!.roles.includes("superadmin");
  const noRoles = !!identity?.authed && identity!.roles.length === 0;
  const rolesErrored = !!identity?.rolesError;

  const stage = notAuthed
    ? { code: "AUTH_MISSING", title: "Not signed in", color: "text-emergency" }
    : rolesErrored
    ? { code: "ROLE_LOOKUP_FAILED", title: "Role lookup failed", color: "text-caution" }
    : noRoles
    ? { code: "NO_ROLES_ASSIGNED", title: "No roles assigned to this account", color: "text-caution" }
    : hasRolesButNotSuper
    ? { code: "ROLE_INSUFFICIENT", title: "Account is missing the superadmin role", color: "text-caution" }
    : { code: "UNKNOWN", title: "Access denied", color: "text-emergency" };

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <header className="text-center space-y-2">
        <Shield className={`size-10 mx-auto ${stage.color}`} />
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">VeloMed Superadmin · /superadmin</div>
        <h1 className="text-xl font-bold">Access denied</h1>
        <div className="mono text-[11px] text-muted-foreground">{stage.code} · {stage.title}</div>
      </header>

      <section className="rounded-xl border border-hairline bg-panel p-4 space-y-3 text-sm">
        <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-muted-foreground"><AlertTriangle className="size-3.5 text-caution" /> Diagnosis</div>
        <ul className="space-y-1.5">
          <Diag ok={!!identity?.authed} label="Authenticated session present" />
          <Diag ok={!!identity?.emailVerified} label="Email verified" hint={identity?.email ?? undefined} />
          <Diag ok={!identity?.rolesError} label="Role lookup succeeded" hint={identity?.rolesError ?? undefined} />
          <Diag ok={!!identity && identity.roles.length > 0} label="At least one role assigned" hint={identity ? `${identity.roles.length} role(s)` : undefined} />
          <Diag ok={!!identity?.roles.includes("superadmin")} label="Has 'superadmin' role" />
        </ul>
      </section>

      {identity?.authed && (
        <section className="rounded-xl border border-hairline bg-panel p-4 space-y-2 text-xs">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Identity snapshot</div>
          <Row label="user_id" value={identity.userId ?? "—"} mono />
          <Row label="email" value={identity.email ?? "—"} />
          <Row label="provider" value={identity.provider ?? "—"} />
          <Row label="roles" value={identity.roles.join(", ") || "—"} />
        </section>
      )}

      <section className="rounded-xl border border-hairline bg-panel p-4 space-y-2 text-sm">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Next steps</div>
        {notAuthed && <p>Your session has expired or is missing. Sign in again, then return to <code className="mono">/superadmin</code>.</p>}
        {noRoles && <p>Your account is authenticated but has no role rows in <code className="mono">user_roles</code>. Sign in with a verified <code className="mono text-action">@velomedos.com</code> address (which auto-grants superadmin) or ask an existing superadmin to grant your account the role.</p>}
        {hasRolesButNotSuper && <p>You have roles, but not <code className="mono text-action">superadmin</code>. Ask an existing superadmin to grant it from <Link to="/superadmin" className="text-action underline">/superadmin → Roles &amp; access</Link>, or sign in with a verified <code className="mono">@velomedos.com</code> account.</p>}
        {rolesErrored && <p>The role lookup query failed. This usually means a database policy or grant is missing on <code className="mono">user_roles</code>. Share the diagnostic code <code className="mono text-action">{stage.code}</code> and the snapshot above.</p>}
      </section>

      <div className="flex flex-wrap gap-2 justify-center">
        <button onClick={() => refresh()} className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated flex items-center gap-1.5"><RefreshCw className="size-3" /> Re-run diagnostic</button>
        <Link to="/auth" className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated">Sign in again</Link>
        <Link to="/admin" className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated">Back to admin</Link>
      </div>
    </main>
  );
}

function Diag({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="size-4 text-stable shrink-0 mt-0.5" /> : <XCircle className="size-4 text-emergency shrink-0 mt-0.5" />}
      <div>
        <div>{label}</div>
        {hint && <div className="mono text-[10px] text-muted-foreground">{hint}</div>}
      </div>
    </li>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
      <div className="px-4 py-2.5 border-b border-hairline mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
        <span>{title}</span>{right}
      </div>
      {children}
    </div>
  );
}

function OverviewPane({ stats, subs, plans, tenants, reqs }: { stats: any; subs: Sub[]; plans: Plan[]; tenants: Tenant[]; reqs: Req[] }) {
  const byPlan = plans.map((p) => ({
    plan: p,
    count: subs.filter((s) => s.plan_id === p.id && ["trialing","active","past_due"].includes(s.status)).length,
  }));
  const totalActive = byPlan.reduce((a, b) => a + b.count, 0) || 1;
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Subscription mix">
        <div className="p-4 space-y-3">
          {byPlan.map(({ plan, count }) => (
            <div key={plan.id} className="space-y-1">
              <div className="flex justify-between mono text-[11px]">
                <span className="text-foreground">{plan.name}</span>
                <span className="text-muted-foreground">{count} · {fmtMoney(plan.price_cents, plan.currency)}/{plan.billing_period}</span>
              </div>
              <div className="h-1.5 rounded bg-panel-elevated overflow-hidden">
                <div className="h-full bg-action" style={{ width: `${(count / totalActive) * 100}%` }} />
              </div>
            </div>
          ))}
          {byPlan.length === 0 && <div className="text-sm text-muted-foreground">No plans yet.</div>}
        </div>
      </Card>
      <Card title="Platform telemetry">
        <div className="grid grid-cols-2 gap-px bg-hairline">
          {[
            ["Incidents", stats.incidents], ["Ambulances", stats.ambulances],
            ["Tenants", tenants.length], ["Webhooks", stats.webhooks],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-panel p-3">
              <div className="mono text-[10px] uppercase text-muted-foreground">{k}</div>
              <div className="text-xl font-bold mono">{v as any}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Pipeline" right={<span className="text-caution">{reqs.filter((r) => r.status === "new").length} new</span>}>
        <div className="divide-y divide-hairline max-h-[260px] overflow-auto">
          {reqs.slice(0, 8).map((r) => (
            <div key={r.id} className="px-4 py-2.5">
              <div className="font-semibold text-sm truncate">{r.company_name}</div>
              <div className="mono text-[10px] text-muted-foreground truncate">{r.contact_email} · {r.status}</div>
            </div>
          ))}
          {reqs.length === 0 && <div className="p-4 text-sm text-muted-foreground">No inbound leads.</div>}
        </div>
      </Card>
    </div>
  );
}

function TenantsPane({
  tenants, subs, plans, toggleStatus, assignPlan,
}: { tenants: Tenant[]; subs: Sub[]; plans: Plan[]; toggleStatus: (t: Tenant) => void; assignPlan: (tenantId: string, planId: string, seats: number) => void }) {
  const [q, setQ] = useState("");
  const filtered = tenants.filter((t) => (t.company_name + " " + (t.slug ?? "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Card title={`Tenants · ${tenants.length}`} right={
      <div className="flex items-center gap-1 bg-panel-elevated rounded px-2 py-0.5 normal-case text-xs">
        <Search className="size-3 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search" className="bg-transparent outline-none w-40" />
      </div>
    }>
      <div className="divide-y divide-hairline">
        {filtered.map((t) => {
          const sub = subs.find((s) => s.tenant_id === t.id && ["trialing","active","past_due"].includes(s.status));
          const plan = sub ? plans.find((p) => p.id === sub.plan_id) : null;
          return (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                {t.logo_url ? <img src={t.logo_url} alt="" className="size-10 rounded bg-white object-contain p-1" /> : <div className="size-10 rounded bg-panel-elevated grid place-items-center text-muted-foreground"><Building2 className="size-4" /></div>}
                <div className="min-w-0">
                  <div className="font-semibold truncate">{t.company_name}</div>
                  <div className="mono text-[11px] text-muted-foreground truncate">{t.slug} · {t.country} · joined {new Date(t.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {plan ? (
                  <span className={`mono text-[10px] uppercase px-2 py-1 rounded ${STATUS_COLORS[sub!.status]}`}>
                    {plan.name} · {sub!.seats} seats · {sub!.status}
                  </span>
                ) : (
                  <span className="mono text-[10px] uppercase px-2 py-1 rounded bg-muted text-muted-foreground">No plan</span>
                )}
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) { assignPlan(t.id, e.target.value, plans.find((p) => p.id === e.target.value)?.included_seats ?? 5); e.target.value = ""; } }}
                  className="bg-panel-elevated border border-hairline rounded px-2 py-1 mono text-[10px] uppercase"
                >
                  <option value="">Assign plan…</option>
                  {plans.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({fmtMoney(p.price_cents, p.currency)}/{p.billing_period})</option>
                  ))}
                </select>
                <button onClick={() => toggleStatus(t)} className={`mono text-[10px] uppercase px-2 py-1 rounded ${t.status === "active" ? "bg-stable/20 text-stable hover:bg-stable/30" : "bg-emergency/20 text-emergency hover:bg-emergency/30"}`}>{t.status}</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No tenants match.</div>}
      </div>
    </Card>
  );
}

function SubsPane({
  subs, plans, tenants, changeStatus, updateSeats,
}: { subs: Sub[]; plans: Plan[]; tenants: Tenant[]; changeStatus: (id: string, s: string) => void; updateSeats: (id: string, n: number) => void }) {
  return (
    <Card title={`Subscriptions · ${subs.length}`}>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="mono text-[10px] uppercase tracking-widest text-muted-foreground bg-panel-elevated/50">
            <tr><th className="text-left p-3">Tenant</th><th className="text-left p-3">Plan</th><th className="text-left p-3">Status</th><th className="text-left p-3">Seats</th><th className="text-left p-3">Period</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {subs.map((s) => {
              const t = tenants.find((x) => x.id === s.tenant_id);
              const p = plans.find((x) => x.id === s.plan_id);
              return (
                <tr key={s.id}>
                  <td className="p-3 font-medium">{t?.company_name ?? "—"}</td>
                  <td className="p-3">{p?.name ?? "—"} <span className="mono text-[10px] text-muted-foreground">{p ? fmtMoney(p.price_cents, p.currency) + "/" + p.billing_period : ""}</span></td>
                  <td className="p-3"><span className={`mono text-[10px] uppercase px-2 py-0.5 rounded ${STATUS_COLORS[s.status]}`}>{s.status}</span></td>
                  <td className="p-3">
                    <input type="number" defaultValue={s.seats} min={1}
                      onBlur={(e) => { const n = Number(e.target.value); if (n && n !== s.seats) updateSeats(s.id, n); }}
                      className="w-16 bg-input border border-hairline rounded px-2 py-0.5 mono text-xs" />
                  </td>
                  <td className="p-3 mono text-[10px] text-muted-foreground">
                    {new Date(s.current_period_start).toLocaleDateString()} →<br />
                    {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "open"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      {s.status !== "active" && <button onClick={() => changeStatus(s.id, "active")} className="px-2 py-1 mono text-[10px] uppercase rounded bg-stable/20 text-stable hover:bg-stable/30"><Play className="size-3 inline" /> Activate</button>}
                      {s.status === "active" && <button onClick={() => changeStatus(s.id, "suspended")} className="px-2 py-1 mono text-[10px] uppercase rounded bg-caution/20 text-caution hover:bg-caution/30"><Pause className="size-3 inline" /> Suspend</button>}
                      {s.status !== "cancelled" && <button onClick={() => changeStatus(s.id, "cancelled")} className="px-2 py-1 mono text-[10px] uppercase rounded bg-emergency/20 text-emergency hover:bg-emergency/30">Cancel</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {subs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No subscriptions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PlansPane({ plans, togglePlan, subs }: { plans: Plan[]; togglePlan: (id: string, active: boolean) => void; subs: Sub[] }) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {plans.map((p) => {
        const active = subs.filter((s) => s.plan_id === p.id && ["trialing","active","past_due"].includes(s.status)).length;
        return (
          <div key={p.id} className={`rounded-xl border ${p.is_active ? "border-hairline" : "border-dashed border-muted opacity-60"} bg-panel p-5 flex flex-col gap-3`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="mono text-[10px] uppercase tracking-widest text-action">{p.code}</div>
                <div className="text-lg font-bold">{p.name}</div>
              </div>
              <button onClick={() => togglePlan(p.id, p.is_active)} className="mono text-[10px] uppercase px-2 py-0.5 rounded border border-hairline hover:bg-panel-elevated">
                {p.is_active ? "Active" : "Paused"}
              </button>
            </div>
            <div className="text-3xl font-bold mono">{fmtMoney(p.price_cents, p.currency)}<span className="text-sm text-muted-foreground font-normal">/{p.billing_period}</span></div>
            <p className="text-xs text-muted-foreground">{p.description}</p>
            <ul className="text-xs space-y-1">
              {p.features.map((f, i) => <li key={i} className="flex gap-1.5"><CheckCircle2 className="size-3 text-stable shrink-0 mt-0.5" />{f}</li>)}
            </ul>
            <div className="mt-auto pt-3 border-t border-hairline flex justify-between mono text-[10px] uppercase text-muted-foreground">
              <span>{p.included_seats} seats</span><span>{active} subscribers</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RolesPane({
  profiles, roles, grantRole, revokeRole,
}: { profiles: Profile[]; roles: RoleRow[]; grantRole: (u: string, r: string) => void; revokeRole: (u: string, r: string) => void }) {
  const [q, setQ] = useState("");
  const rolesByUser = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of roles) {
      if (!m.has(r.user_id)) m.set(r.user_id, []);
      m.get(r.user_id)!.push(r.role);
    }
    return m;
  }, [roles]);
  const filtered = profiles.filter((p) => (p.email + " " + (p.full_name ?? "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Card title={`Users & access · ${profiles.length}`} right={
      <div className="flex items-center gap-1 bg-panel-elevated rounded px-2 py-0.5 normal-case text-xs">
        <Search className="size-3 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search email or name" className="bg-transparent outline-none w-56" />
      </div>
    }>
      <div className="divide-y divide-hairline max-h-[640px] overflow-auto">
        {filtered.slice(0, 200).map((p) => {
          const myRoles = rolesByUser.get(p.id) ?? [];
          return (
            <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold truncate">{p.full_name ?? "—"}</div>
                <div className="mono text-[11px] text-muted-foreground truncate">{p.email}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {myRoles.length === 0 && <span className="mono text-[10px] text-muted-foreground">no roles</span>}
                {myRoles.map((r) => (
                  <span key={r} className={`group inline-flex items-center gap-1 mono text-[10px] uppercase px-2 py-0.5 rounded ${r === "superadmin" ? "bg-emergency/20 text-emergency" : r === "business_admin" ? "bg-action/20 text-action" : "bg-panel-elevated text-foreground"}`}>
                    {r}
                    <button onClick={() => revokeRole(p.id, r)} className="opacity-50 hover:opacity-100"><Trash2 className="size-2.5" /></button>
                  </span>
                ))}
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) { grantRole(p.id, e.target.value); e.target.value = ""; } }}
                  className="bg-panel-elevated border border-hairline rounded px-2 py-0.5 mono text-[10px] uppercase"
                >
                  <option value="">+ Grant role</option>
                  {ALL_ROLES.filter((r) => !myRoles.includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No users match.</div>}
      </div>
    </Card>
  );
}

function RequestsPane({ reqs, review }: { reqs: Req[]; review: (id: string, s: "approved" | "rejected") => void }) {
  return (
    <Card title={`Business requests · ${reqs.length}`}>
      <div className="divide-y divide-hairline">
        {reqs.length === 0 && <div className="p-6 text-sm text-muted-foreground">No inbound requests yet.</div>}
        {reqs.map((r) => (
          <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-semibold truncate">{r.company_name} <span className="mono text-[10px] text-muted-foreground">· {r.country ?? "—"} · fleet {r.fleet_size ?? "?"}</span></div>
              <div className="mono text-[11px] text-muted-foreground truncate">{r.contact_name} · {r.contact_email} · {r.contact_phone ?? ""}</div>
              {r.use_case && <div className="text-xs text-muted-foreground truncate mt-0.5">{r.use_case}</div>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`mono text-[10px] uppercase px-2 py-0.5 rounded ${r.status === "new" ? "bg-caution/20 text-caution" : r.status === "approved" ? "bg-stable/20 text-stable" : "bg-emergency/20 text-emergency"}`}>{r.status}</span>
              {r.status === "new" && (
                <>
                  <button onClick={() => review(r.id, "approved")} className="size-7 grid place-items-center rounded hover:bg-stable/10 text-stable"><CheckCircle2 className="size-4" /></button>
                  <button onClick={() => review(r.id, "rejected")} className="size-7 grid place-items-center rounded hover:bg-emergency/10 text-emergency"><XCircle className="size-4" /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============================== API keys ============================== */

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "").replace(/\//g, "").replace(/=/g, "");
  return `vmk_${b64}`;
}

function ApiKeysPane({
  keys, tenants, profiles, revoke, reload,
}: { keys: ApiKey[]; tenants: Tenant[]; profiles: Profile[]; revoke: (id: string) => void; reload: () => void }) {
  const [name, setName] = useState("");
  const [tenantId, setTenantId] = useState<string>("");
  const [scopes, setScopes] = useState<string[]>(["fleet:read","incidents:read"]);
  const [rate, setRate] = useState<number>(600);
  const [issued, setIssued] = useState<string | null>(null);
  const [filterTenant, setFilterTenant] = useState<string>("");

  async function issue(rotateOf?: ApiKey) {
    const finalName = rotateOf ? rotateOf.name : name.trim();
    if (!finalName) return toast.error("Name required");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const raw = randomKey();
    const prefix = raw.slice(0, 12);
    const hashed = await sha256Hex(raw);
    const { error } = await (supabase as any).from("api_keys").insert({
      name: finalName, owner_id: user.id,
      tenant_id: rotateOf ? rotateOf.tenant_id : (tenantId || null),
      prefix, hashed_key: hashed,
      scopes: rotateOf ? rotateOf.scopes : scopes,
      rate_limit_per_min: rotateOf ? rotateOf.rate_limit_per_min : rate,
    });
    if (error) return toast.error(error.message);
    if (rotateOf) await (supabase as any).from("api_keys").delete().eq("id", rotateOf.id);
    setIssued(raw); setName("");
    toast.success(rotateOf ? "Key rotated" : "Key issued");
    reload();
  }

  const filtered = filterTenant === "_personal"
    ? keys.filter((k) => !k.tenant_id)
    : filterTenant
    ? keys.filter((k) => k.tenant_id === filterTenant)
    : keys;

  return (
    <div className="space-y-4">
      <Card title="Issue API key">
        <div className="p-4 space-y-3">
          <div className="grid lg:grid-cols-[1fr_220px_120px_auto] gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Connect Care – production server" className="h-10 px-3 rounded bg-input border border-hairline text-sm" />
            <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-10 px-2 rounded bg-input border border-hairline text-sm">
              <option value="">Platform key (no tenant)</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.company_name}</option>)}
            </select>
            <input type="number" min={1} max={6000} value={rate} onChange={(e) => setRate(Math.max(1, Number(e.target.value) || 60))} className="h-10 px-3 rounded bg-input border border-hairline text-sm mono" title="Rate limit per minute" />
            <button onClick={() => issue()} className="h-10 px-4 rounded bg-action text-action-foreground mono text-xs uppercase tracking-widest font-bold whitespace-nowrap">Generate</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_SCOPES.map((s) => {
              const on = scopes.includes(s);
              return (
                <button key={s} type="button"
                  onClick={() => setScopes(on ? scopes.filter((x) => x !== s) : [...scopes, s])}
                  className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${on ? "border-action/60 bg-action/20 text-action" : "border-hairline text-muted-foreground hover:text-foreground"}`}>
                  {s}
                </button>
              );
            })}
          </div>
          {issued && (
            <div className="rounded-md border border-caution/50 bg-caution/10 p-3 space-y-2">
              <div className="mono text-[10px] uppercase tracking-widest text-caution">Copy now — shown once</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs break-all">{issued}</code>
                <button onClick={() => { navigator.clipboard.writeText(issued); toast.success("Copied"); }} className="size-8 grid place-items-center rounded hover:bg-panel-elevated"><Copy className="size-4" /></button>
              </div>
              <button onClick={() => setIssued(null)} className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">I've saved it</button>
            </div>
          )}
        </div>
      </Card>

      <Card title={`Active keys · ${filtered.length}`} right={
        <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)} className="bg-panel-elevated border border-hairline rounded px-2 py-0.5 mono text-[10px] uppercase normal-case">
          <option value="">All tenants</option>
          <option value="_personal">Personal / platform</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.company_name}</option>)}
        </select>
      }>
        <div className="divide-y divide-hairline">
          {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No keys.</div>}
          {filtered.map((k) => {
            const tenant = tenants.find((t) => t.id === k.tenant_id);
            const owner = profiles.find((p) => p.id === k.owner_id);
            const stale = k.last_used_at && (Date.now() - new Date(k.last_used_at).getTime() > 30 * 864e5);
            return (
              <div key={k.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2"><KeyRound className="size-4 text-action" />{k.name}</div>
                  <div className="mono text-[11px] text-muted-foreground truncate">
                    {k.prefix}… · {tenant ? <span className="text-action">{tenant.company_name}</span> : <span>platform/personal</span>} · owner {owner?.email ?? k.owner_id.slice(0,8)} · {k.rate_limit_per_min}/min
                  </div>
                  <div className="mono text-[10px] text-action/80 mt-0.5">{(k.scopes ?? []).join(" · ")}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="mono text-[10px] uppercase text-right">
                    <div className="text-muted-foreground">Last used</div>
                    <div className={stale ? "text-caution" : "text-foreground"}>
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                    </div>
                  </div>
                  <button onClick={() => issue(k)} title="Rotate (issue new key, revoke this one)"
                    className="size-9 grid place-items-center rounded text-muted-foreground hover:text-action hover:bg-action/10"><RefreshCw className="size-4" /></button>
                  <button onClick={() => revoke(k.id)} title="Revoke"
                    className="size-9 grid place-items-center rounded text-muted-foreground hover:text-emergency hover:bg-emergency/10"><Trash2 className="size-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ============================== Privileges (preview) ============================== */

function PrivilegesPane({ profiles, roles }: { profiles: Profile[]; roles: RoleRow[] }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const rolesByUser = useMemo(() => {
    const m = new Map<string, AppRole[]>();
    for (const r of roles) {
      if (!m.has(r.user_id)) m.set(r.user_id, []);
      m.get(r.user_id)!.push(r.role as AppRole);
    }
    return m;
  }, [roles]);
  const filteredProfiles = profiles
    .filter((p) => ((p.email ?? "") + " " + (p.full_name ?? "")).toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20);
  const selectedRoles = (selected && rolesByUser.get(selected)) || [];
  const effective = effectiveCapabilities(selectedRoles);
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-4 gap-3">
        {ROLE_ORDER.map((r) => {
          const m = ROLE_META[r];
          const count = CAPABILITIES.filter((c) => c.roles.includes(r)).length;
          return (
            <div key={r} className="rounded-xl border border-hairline bg-panel p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${m.tone}`}>{m.label}</span>
                <span className="mono text-[10px] text-muted-foreground">{count} caps</span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-snug">{m.blurb}</div>
            </div>
          );
        })}
      </div>

      <Card title="Effective permissions resolver" right={
        <div className="flex items-center gap-1 bg-panel-elevated rounded px-2 py-0.5 normal-case text-xs">
          <Search className="size-3 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search user" className="bg-transparent outline-none w-56" />
        </div>
      }>
        <div className="p-4 space-y-3">
          {q && (
            <div className="flex flex-wrap gap-1">
              {filteredProfiles.map((p) => (
                <button key={p.id} onClick={() => { setSelected(p.id); setQ(""); }}
                  className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated">
                  {p.email ?? p.id.slice(0,8)}
                </button>
              ))}
              {filteredProfiles.length === 0 && <span className="text-xs text-muted-foreground">No matches</span>}
            </div>
          )}
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-semibold">{profiles.find(p => p.id === selected)?.email}</div>
                <div className="flex flex-wrap gap-1">
                  {selectedRoles.length === 0
                    ? <span className="mono text-[10px] text-muted-foreground">No roles</span>
                    : selectedRoles.map((r) => <span key={r} className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${ROLE_META[r].tone}`}>{ROLE_META[r].label}</span>)}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {effective.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="size-3.5 text-stable shrink-0 mt-0.5" />
                    <div><span className="font-medium">{c.label}</span> <span className="text-muted-foreground">· {c.area}</span></div>
                  </div>
                ))}
                {effective.length === 0 && <div className="text-xs text-muted-foreground">No capabilities — this user has no roles.</div>}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Search and pick a user to see their effective permissions.</div>
          )}
          <div className="pt-2 border-t border-hairline">
            <Link to="/privileges" className="mono text-[10px] uppercase tracking-widest text-action hover:underline">Open full privileges matrix →</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================== API docs (Swagger snapshot) ============================== */

function ApiDocsPane() {
  const paths = Object.entries(openApiSpec.paths as Record<string, any>);
  const totalOps = paths.reduce((acc, [, methods]) => acc + Object.keys(methods).length, 0);
  const adminPaths = Object.entries(openApiAdminSpec.paths as Record<string, any>);
  const adminOps = adminEndpointCount();
  return (
    <div className="space-y-4">
      {/* ── Admin Control Plane (internal) ── */}
      <Card title={`Admin Control Plane · ${openApiAdminSpec.info.version}`} right={
        <div className="flex items-center gap-2 normal-case">
          <span className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-stable/15 text-stable border border-stable/30">INTERNAL</span>
          <a href="/api/admin/v1/openapi" target="_blank" rel="noreferrer" className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-hairline hover:bg-panel-elevated">openapi.json ↗</a>
          <Link to="/superadmin/api-docs" className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-stable text-black font-bold">Open in-portal Swagger →</Link>
        </div>
      }>
        <div className="p-4 grid sm:grid-cols-4 gap-px bg-hairline rounded overflow-hidden border border-hairline">
          <div className="bg-panel p-3"><div className="mono text-[10px] uppercase text-muted-foreground">Routes</div><div className="text-2xl font-bold mono">{adminPaths.length}</div></div>
          <div className="bg-panel p-3"><div className="mono text-[10px] uppercase text-muted-foreground">Operations</div><div className="text-2xl font-bold mono">{adminOps}</div></div>
          <div className="bg-panel p-3"><div className="mono text-[10px] uppercase text-muted-foreground">Auth</div><div className="text-xs mono pt-1">x-admin-key · session</div></div>
          <div className="bg-panel p-3"><div className="mono text-[10px] uppercase text-muted-foreground">Base path</div><div className="text-xs mono pt-1">/api/admin/v1</div></div>
        </div>
        <div className="p-4 text-xs text-muted-foreground border-t border-hairline whitespace-pre-line">
          {openApiAdminSpec.info.description}
        </div>
      </Card>

      <Card title="Admin endpoints">
        <div className="overflow-auto max-h-[420px]">
          <table className="w-full text-sm">
            <thead className="mono text-[10px] uppercase tracking-widest text-muted-foreground bg-panel-elevated/40 sticky top-0">
              <tr><th className="text-left p-2 w-20">Method</th><th className="text-left p-2">Path</th><th className="text-left p-2">Summary</th><th className="text-left p-2">Scope</th></tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {adminPaths.flatMap(([path, methods]) =>
                Object.entries(methods as Record<string, any>).map(([m, op]) => {
                  const scope = (op.description as string | undefined)?.match(/`([a-z]+:[a-z]+)`/)?.[1] ?? "session";
                  return (
                    <tr key={`adm-${m}-${path}`}>
                      <td className="p-2"><span className={`mono text-[10px] uppercase px-2 py-0.5 rounded ${m === "get" ? "bg-action/20 text-action" : m === "post" ? "bg-stable/20 text-stable" : m === "delete" ? "bg-critical/20 text-critical" : "bg-caution/20 text-caution"}`}>{m}</span></td>
                      <td className="p-2 mono text-xs">{path}</td>
                      <td className="p-2 text-xs">{op.summary ?? ""}</td>
                      <td className="p-2 mono text-[10px] text-muted-foreground">{scope}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Public Product API ── */}
      <Card title={`OpenAPI ${openApiSpec.openapi} · ${openApiSpec.info.version}`} right={
        <div className="flex items-center gap-2 normal-case">
          <span className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-action/15 text-action border border-action/30">PUBLIC</span>
          <a href="/api/public/v1/openapi" target="_blank" rel="noreferrer" className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border border-hairline hover:bg-panel-elevated">openapi.json ↗</a>
          <Link to="/api-docs" className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-action text-action-foreground font-bold">Open Swagger UI →</Link>
        </div>
      }>
        <div className="p-4 grid sm:grid-cols-3 gap-px bg-hairline rounded overflow-hidden border border-hairline">
          <div className="bg-panel p-3"><div className="mono text-[10px] uppercase text-muted-foreground">Endpoints</div><div className="text-2xl font-bold mono">{paths.length}</div></div>
          <div className="bg-panel p-3"><div className="mono text-[10px] uppercase text-muted-foreground">Operations</div><div className="text-2xl font-bold mono">{totalOps}</div></div>
          <div className="bg-panel p-3"><div className="mono text-[10px] uppercase text-muted-foreground">Scopes</div><div className="text-2xl font-bold mono">{ALL_SCOPES.length}</div></div>
        </div>
        <div className="p-4 text-xs text-muted-foreground border-t border-hairline whitespace-pre-line">
          {openApiSpec.info.description}
        </div>
      </Card>

      <Card title="Endpoints">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="mono text-[10px] uppercase tracking-widest text-muted-foreground bg-panel-elevated/40">
              <tr><th className="text-left p-2 w-20">Method</th><th className="text-left p-2">Path</th><th className="text-left p-2">Summary</th><th className="text-left p-2">Scope</th></tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {paths.flatMap(([path, methods]) =>
                Object.entries(methods as Record<string, any>).map(([m, op]) => {
                  const scope = (op.description as string | undefined)?.match(/`([a-z]+:[a-z]+)`/)?.[1] ?? "public";
                  return (
                    <tr key={`${m}-${path}`}>
                      <td className="p-2"><span className={`mono text-[10px] uppercase px-2 py-0.5 rounded ${m === "get" ? "bg-action/20 text-action" : m === "post" ? "bg-stable/20 text-stable" : "bg-caution/20 text-caution"}`}>{m}</span></td>
                      <td className="p-2 mono text-xs">{path}</td>
                      <td className="p-2 text-xs">{op.summary ?? ""}</td>
                      <td className="p-2 mono text-[10px] text-muted-foreground">{scope}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Scope catalogue">
        <div className="p-4 flex flex-wrap gap-1.5">
          {ALL_SCOPES.map((s) => (
            <span key={s} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline">{s}</span>
          ))}
          <span className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-action/50 bg-action/10 text-action">*</span>
        </div>
      </Card>
    </div>
  );
}

/* ============================== Debug pane ============================== */

type DebugEvent = {
  id: string;
  tenant_id: string | null;
  source: string;
  kind: string;
  severity: string;
  route: string | null;
  viewport: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

function DebugPane({ tenants }: { tenants: Tenant[] }) {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [tenantId, setTenantId] = useState<string>("");
  const [kind, setKind] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [viewport, setViewport] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DebugEvent | null>(null);

  async function load() {
    setLoading(true);
    let q = (supabase as any).from("debug_events").select("*").order("created_at", { ascending: false }).limit(300);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    if (kind) q = q.eq("kind", kind);
    if (severity) q = q.eq("severity", severity);
    if (viewport) q = q.eq("viewport", viewport);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setEvents((data ?? []) as DebugEvent[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId, kind, severity, viewport]);

  useEffect(() => {
    const ch = (supabase as any)
      .channel("debug-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "debug_events" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line
  }, [tenantId, kind, severity, viewport]);

  const byTenant = useMemo(() => {
    const m = new Map<string, { tenant: Tenant | null; count: number; glitches: number; errors: number }>();
    for (const ev of events) {
      const key = ev.tenant_id ?? "__platform";
      const tenant = ev.tenant_id ? tenants.find((t) => t.id === ev.tenant_id) ?? null : null;
      const cur = m.get(key) ?? { tenant, count: 0, glitches: 0, errors: 0 };
      cur.count += 1;
      if (ev.kind === "glitch") cur.glitches += 1;
      if (ev.severity === "error" || ev.severity === "critical") cur.errors += 1;
      m.set(key, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [events, tenants]);

  const SEV: Record<string, string> = {
    info: "bg-action/15 text-action",
    warn: "bg-caution/20 text-caution",
    error: "bg-emergency/20 text-emergency",
    critical: "bg-emergency text-emergency-foreground",
  };

  return (
    <div className="space-y-4">
      <Card title="Debug · classified per business" right={
        <button onClick={load} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated inline-flex items-center gap-1">
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> refresh
        </button>
      }>
        <div className="p-3 flex flex-wrap gap-2 border-b border-hairline">
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="bg-panel-elevated border border-hairline rounded px-2 py-1 mono text-[10px] uppercase">
            <option value="">All tenants</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.company_name}</option>)}
          </select>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="bg-panel-elevated border border-hairline rounded px-2 py-1 mono text-[10px] uppercase">
            <option value="">Any kind</option>
            {["glitch","snapshot","metric","error","info"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="bg-panel-elevated border border-hairline rounded px-2 py-1 mono text-[10px] uppercase">
            <option value="">Any severity</option>
            {["info","warn","error","critical"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={viewport} onChange={(e) => setViewport(e.target.value)} className="bg-panel-elevated border border-hairline rounded px-2 py-1 mono text-[10px] uppercase">
            <option value="">Any viewport</option>
            {["mobile","tablet","desktop"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <Link to="/api-docs" hash="tag/Debug" className="ml-auto mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated">Debug API ↗</Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-px bg-hairline">
          {byTenant.length === 0 && <div className="bg-panel p-6 text-sm text-muted-foreground col-span-3 text-center">No debug events match these filters.</div>}
          {byTenant.map(([key, agg]) => (
            <div key={key} className="bg-panel p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold truncate">{agg.tenant?.company_name ?? "Platform / unscoped"}</div>
                <span className="mono text-[10px] text-muted-foreground">{agg.count} events</span>
              </div>
              <div className="mt-1 flex gap-2 mono text-[10px] uppercase tracking-widest">
                <span className="px-1.5 py-0.5 rounded bg-caution/20 text-caution">{agg.glitches} glitches</span>
                <span className="px-1.5 py-0.5 rounded bg-emergency/20 text-emergency">{agg.errors} errors</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Stream · ${events.length} latest`}>
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="mono text-[10px] uppercase tracking-widest text-muted-foreground bg-panel-elevated/60 sticky top-0">
              <tr><th className="text-left p-2">Time</th><th className="text-left p-2">Tenant</th><th className="text-left p-2">Source · kind</th><th className="text-left p-2">Sev</th><th className="text-left p-2">Viewport</th><th className="text-left p-2">Message</th><th className="text-left p-2">Route</th></tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {events.map((ev) => {
                const t = ev.tenant_id ? tenants.find((x) => x.id === ev.tenant_id) : null;
                return (
                  <tr key={ev.id} onClick={() => setSelected(ev)} className="hover:bg-panel-elevated/40 cursor-pointer">
                    <td className="p-2 mono text-[10px] text-muted-foreground whitespace-nowrap">{new Date(ev.created_at).toLocaleTimeString()}</td>
                    <td className="p-2 truncate max-w-[140px]">{t?.company_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2 mono text-[10px]">{ev.source} · {ev.kind}</td>
                    <td className="p-2"><span className={`mono text-[9px] uppercase px-1.5 py-0.5 rounded ${SEV[ev.severity] ?? ""}`}>{ev.severity}</span></td>
                    <td className="p-2 mono text-[10px] uppercase text-muted-foreground">{ev.viewport ?? "—"}</td>
                    <td className="p-2 truncate max-w-[280px]">{ev.message ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2 mono text-[10px] text-muted-foreground truncate max-w-[200px]">{ev.route ?? "—"}</td>
                  </tr>
                );
              })}
              {events.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Quiet · no debug events.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm grid place-items-center p-6" onClick={() => setSelected(null)}>
          <div className="bg-panel border border-hairline rounded-xl w-full max-w-2xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-hairline flex items-center justify-between">
              <div>
                <div className="mono text-[10px] uppercase tracking-widest text-action">{selected.source} · {selected.kind} · {selected.severity}</div>
                <div className="font-semibold">{selected.message ?? "(no message)"}</div>
                <div className="mono text-[10px] text-muted-foreground">{selected.route ?? "—"} · {selected.viewport ?? "—"} · {new Date(selected.created_at).toLocaleString()}</div>
              </div>
              <button onClick={() => setSelected(null)} className="mono text-[10px] uppercase px-2 py-1 rounded border border-hairline">Close</button>
            </div>
            <pre className="p-4 text-[11px] mono whitespace-pre-wrap break-all">{JSON.stringify(selected.payload, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}