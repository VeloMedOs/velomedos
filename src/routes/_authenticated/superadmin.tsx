import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, Building2, Activity, KeyRound, Webhook, Users, Server,
  CheckCircle2, XCircle, CreditCard, Package, UserCog, LayoutDashboard,
  Plus, Trash2, Search, BadgeCheck, Pause, Play, RefreshCw, Copy, BookOpen, Lock,
} from "lucide-react";
import { openApiSpec } from "@/lib/openapi-spec";
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

const ALL_ROLES = ["superadmin","admin","dispatcher","developer","business_admin","paramedic","driver","patient"] as const;
const ALL_SCOPES = ["fleet:read","incidents:read","incidents:write","clinics:read","courses:read","compliance:read","screening:read","screening:write"] as const;
const STATUS_COLORS: Record<string, string> = {
  trialing:   "bg-action/20 text-action",
  active:     "bg-stable/20 text-stable",
  past_due:   "bg-caution/20 text-caution",
  cancelled:  "bg-muted text-muted-foreground",
  suspended:  "bg-emergency/20 text-emergency",
};
const fmtMoney = (c: number, cur: string) =>
  c === 0 ? "Custom" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(c / 100);

type TabId = "overview" | "tenants" | "subs" | "plans" | "roles" | "apikeys" | "privileges" | "apidocs" | "requests";

function Superadmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState({ users: 0, incidents: 0, ambulances: 0, apiKeys: 0, webhooks: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setAllowed(false);
      const { data: roles } = await (supabase as any).rpc("get_user_roles", { _user_id: user.id });
      const list: string[] = (roles ?? []).map((r: any) => typeof r === "string" ? r : r.role);
      setAllowed(list.includes("superadmin"));
    })();
  }, []);

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
  if (!allowed) return (
    <div className="p-10 max-w-xl mx-auto text-center space-y-2">
      <Shield className="size-10 mx-auto text-emergency" />
      <h1 className="text-xl font-bold">Superadmin access required</h1>
      <p className="text-sm text-muted-foreground">Sign in with a VeloMed superadmin account (any verified <code className="mono text-action">@velomedos.com</code> address). Your account does not have the <code className="mono text-action">superadmin</code> role.</p>
      <Link to="/admin" className="inline-block mt-2 mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline">Back to admin</Link>
    </div>
  );

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