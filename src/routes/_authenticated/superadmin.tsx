import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Building2, Activity, KeyRound, Webhook, Users, Server, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superadmin")({
  head: () => ({ meta: [{ title: "Superadmin · VeloMed OS" }] }),
  component: Superadmin,
});

type Tenant = { id: string; company_name: string; slug: string | null; logo_url: string | null; status: string; plan_tier: string; country: string | null; created_at: string };
type Req = { id: string; company_name: string; contact_name: string; contact_email: string; contact_phone: string | null; country: string | null; fleet_size: number | null; use_case: string | null; status: string; created_at: string };

function Superadmin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
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
    const [t, r, prof, inc, amb, ak, wh] = await Promise.all([
      (supabase as any).from("corporate_accounts").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("business_requests").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("incidents").select("id", { count: "exact", head: true }),
      supabase.from("ambulances").select("id", { count: "exact", head: true }),
      supabase.from("api_keys").select("id", { count: "exact", head: true }),
      (supabase as any).from("webhook_subscriptions").select("id", { count: "exact", head: true }),
    ]);
    setTenants((t.data ?? []) as Tenant[]);
    setReqs((r.data ?? []) as Req[]);
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

  if (allowed === null) return <div className="p-10 mono text-xs text-muted-foreground">Verifying…</div>;
  if (!allowed) return (
    <div className="p-10 max-w-xl mx-auto text-center space-y-2">
      <Shield className="size-10 mx-auto text-emergency" />
      <h1 className="text-xl font-bold">Superadmin access required</h1>
      <p className="text-sm text-muted-foreground">Sign in with a VeloMed superadmin account (@velomed.io). Your account does not have the <code className="mono text-action">superadmin</code> role.</p>
      <Link to="/admin" className="inline-block mt-2 mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline">Back to admin</Link>
    </div>
  );

  const newReqs = reqs.filter((r) => r.status === "new").length;

  return (
    <main className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-emergency flex items-center gap-2"><Shield className="size-3" /> VeloMed Superadmin</div>
          <h1 className="text-2xl font-bold tracking-tight">Platform control plane</h1>
        </div>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emergency animate-pulse" /> Global · all tenants
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-6 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {[
          { label: "Tenants", value: tenants.length, icon: Building2 },
          { label: "New requests", value: newReqs, icon: Webhook, accent: newReqs > 0 ? "text-caution" : "" },
          { label: "Users", value: stats.users, icon: Users },
          { label: "Incidents", value: stats.incidents, icon: Activity },
          { label: "Ambulances", value: stats.ambulances, icon: Server },
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

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-hairline mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            <span>Business requests</span><span className="text-caution">{newReqs} new</span>
          </div>
          <div className="divide-y divide-hairline max-h-[460px] overflow-auto">
            {reqs.length === 0 && <div className="p-6 text-sm text-muted-foreground">No requests yet.</div>}
            {reqs.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
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
        </div>

        <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-hairline mono text-[10px] uppercase tracking-widest text-muted-foreground">Tenants · {tenants.length}</div>
          <div className="divide-y divide-hairline max-h-[460px] overflow-auto">
            {tenants.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {t.logo_url ? <img src={t.logo_url} alt="" className="size-9 rounded bg-white object-contain p-1" /> : <div className="size-9 rounded bg-panel-elevated grid place-items-center text-muted-foreground"><Building2 className="size-4" /></div>}
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{t.company_name}</div>
                    <div className="mono text-[11px] text-muted-foreground truncate">{t.slug} · {t.plan_tier} · {t.country}</div>
                  </div>
                </div>
                <button onClick={() => toggleStatus(t)} className={`mono text-[10px] uppercase px-2 py-1 rounded ${t.status === "active" ? "bg-stable/20 text-stable hover:bg-stable/30" : "bg-emergency/20 text-emergency hover:bg-emergency/30"}`}>{t.status}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-panel p-4">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Quick links</div>
        <div className="flex flex-wrap gap-2">
          {[
            ["/developer", "API keys & scopes"],
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