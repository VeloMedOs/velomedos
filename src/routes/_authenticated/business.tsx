import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Ambulance, Activity, Users, GraduationCap, Stethoscope } from "lucide-react";
import { BusinessSideNav } from "@/components/business/SideNav";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({ meta: [{ title: "Business Workspace · VeloMed OS" }] }),
  component: BusinessWorkspace,
});

type Tenant = { id: string; company_name: string; slug: string | null; logo_url: string | null; primary_color: string | null; accent_color: string | null; plan_tier: string; country: string | null; status: string };

function BusinessWorkspace() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ units: 0, active: 0, incidents: 0, courses: 0, telehealth: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: mem } = await (supabase as any).from("tenant_members").select("tenant_id").eq("user_id", user.id).maybeSingle();
      let tenantRow: Tenant | null = null;
      if (mem?.tenant_id) {
        const { data } = await (supabase as any).from("corporate_accounts").select("*").eq("id", mem.tenant_id).maybeSingle();
        tenantRow = data as Tenant | null;
      } else {
        const { data } = await (supabase as any).from("corporate_accounts").select("*").eq("owner_user_id", user.id).maybeSingle();
        tenantRow = data as Tenant | null;
      }
      setTenant(tenantRow);

      const [amb, inc, courses, tele] = await Promise.all([
        supabase.from("ambulances").select("status"),
        supabase.from("incidents").select("id", { count: "exact", head: true }).in("status", ["assigned", "en_route", "on_scene", "transporting"]),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("telehealth_sessions").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
      ]);
      const rows = amb.data ?? [];
      setKpis({
        units: rows.length,
        active: rows.filter((r) => ["dispatched", "en_route", "on_scene", "transporting"].includes(r.status as unknown as string)).length,
        incidents: inc.count ?? 0,
        courses: courses.count ?? 0,
        telehealth: tele.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-10 mono text-xs text-muted-foreground">Loading workspace…</div>;
  if (!tenant) return (
    <div className="flex min-h-screen bg-background">
      <BusinessSideNav />
      <main className="flex-1 max-w-xl mx-auto p-10 text-center space-y-3">
        <Building2 className="size-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-bold">No business workspace</h1>
        <p className="text-sm text-muted-foreground">Your account isn't linked to a business tenant yet. Ask a VeloMed superadmin to assign you, or sign in with your business email.</p>
      </main>
    </div>
  );

  const primary = tenant.primary_color ?? "#e94135";
  const accent = tenant.accent_color ?? "#5fb8d9";

  return (
    <div className="flex min-h-screen bg-background">
      <BusinessSideNav companyName={tenant.company_name} planTier={tenant.plan_tier} accent={primary} />
      <main className="flex-1 min-w-0 max-w-[1600px] mx-auto p-6 space-y-6">
      <header className="rounded-xl border border-hairline overflow-hidden">
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${primary}, ${accent})` }} />
        <div className="bg-panel p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.company_name} className="h-14 bg-white rounded-md object-contain p-2" />
            ) : (
              <div className="size-14 rounded-md grid place-items-center text-white font-bold text-xl" style={{ background: primary }}>{tenant.company_name[0]}</div>
            )}
            <div className="min-w-0">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Business workspace</div>
              <h1 className="text-2xl font-bold tracking-tight truncate">{tenant.company_name}</h1>
              <div className="mono text-[11px] text-muted-foreground">{tenant.plan_tier} plan · {tenant.country} · <span className="text-stable">● {tenant.status}</span></div>
            </div>
          </div>
          <div className="hidden md:flex gap-2">
            <Link to="/dispatch" className="mono text-[11px] uppercase tracking-widest px-3 py-2 rounded text-white font-bold" style={{ background: primary }}>Open dispatch →</Link>
            <Link to="/fleet" className="mono text-[11px] uppercase tracking-widest px-3 py-2 rounded border border-hairline hover:bg-panel-elevated">Fleet</Link>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {[
          { label: "Fleet units", value: kpis.units, icon: Ambulance },
          { label: "On mission", value: kpis.active, icon: Activity },
          { label: "Active incidents", value: kpis.incidents, icon: Users },
          { label: "Telehealth queued", value: kpis.telehealth, icon: Stethoscope },
          { label: "Training courses", value: kpis.courses, icon: GraduationCap },
        ].map((c) => (
          <div key={c.label} className="bg-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{c.label}</div>
              <c.icon className="size-4" style={{ color: accent }} />
            </div>
            <div className="text-2xl font-bold mono">{c.value}</div>
          </div>
        ))}
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { to: "/dispatch", title: "Dispatch console", body: "Live map, incident queue, assignment." },
          { to: "/fleet", title: "Fleet management", body: "Vehicles, telemetry, OOS toggles." },
          { to: "/call-center", title: "Call center", body: "Incoming requests, triage, timeline." },
          { to: "/compliance", title: "Compliance", body: "Credentials, defects, work orders." },
          { to: "/screening", title: "Mobile screening", body: "Packages, orders, results." },
          { to: "/training", title: "Training & certificates", body: "Courses, enrollment, certificates." },
        ].map((c) => (
          <Link key={c.to} to={c.to} className="rounded-xl border border-hairline bg-panel p-4 hover:border-action transition-colors">
            <div className="font-semibold">{c.title}</div>
            <div className="text-sm text-muted-foreground mt-1">{c.body}</div>
          </Link>
        ))}
      </section>
      </main>
    </div>
  );
}