import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Ambulance, AlertOctagon, ShieldAlert, Wrench, Radio } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Overview · VeloMed OS" }] }),
  component: AdminOverview,
});

type Kpis = {
  available: number;
  assigned: number;
  total: number;
  activeIncidents: number;
  expiringCreds: number;
  openWorkOrders: number;
  blockingDefects: number;
};
type Event = { id: number; at: string; event_type: string; incident_id: string };

function AdminOverview() {
  const [k, setK] = useState<Kpis | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const [amb, inc, cred, wo, def, ev] = await Promise.all([
        supabase.from("ambulances").select("status"),
        supabase.from("incidents").select("id,status").in("status", ["assigned", "en_route", "on_scene", "transporting"]),
        supabase.from("credentials").select("id").lte("expires_on", soon),
        supabase.from("work_orders").select("id").eq("status", "open"),
        supabase.from("defects").select("id").eq("blocks_service", true).is("resolved_at", null),
        supabase.from("incident_events").select("id,at,event_type,incident_id").order("at", { ascending: false }).limit(15),
      ]);
      if (cancelled) return;
      const rows = amb.data ?? [];
      setK({
        available: rows.filter((r) => r.status === "available").length,
        assigned: rows.filter((r) => ["dispatched", "en_route", "on_scene", "transporting"].includes(r.status as unknown as string)).length,
        total: rows.length,
        activeIncidents: inc.data?.length ?? 0,
        expiringCreds: cred.data?.length ?? 0,
        openWorkOrders: wo.data?.length ?? 0,
        blockingDefects: def.data?.length ?? 0,
      });
      setEvents(ev.data ?? []);
    }
    load();
    const t = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const utilization = k && k.total > 0 ? Math.round((k.assigned / k.total) * 100) : 0;

  return (
    <main className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Command center</div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Overview</h1>
        </div>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-stable animate-pulse" /> Live · 15s refresh
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {[
          { label: "Units available", value: k?.available ?? "—", icon: Ambulance, accent: "text-stable" },
          { label: "Units assigned", value: k?.assigned ?? "—", icon: Radio, accent: "text-action" },
          { label: "Active incidents", value: k?.activeIncidents ?? "—", icon: Activity, accent: "text-emergency" },
          { label: "Fleet utilization", value: `${utilization}%`, icon: Radio, accent: "text-action" },
          { label: "Expiring credentials (30d)", value: k?.expiringCreds ?? "—", icon: ShieldAlert, accent: "text-caution" },
          { label: "Open work orders", value: k?.openWorkOrders ?? "—", icon: Wrench, accent: "text-caution" },
          { label: "Blocking defects", value: k?.blockingDefects ?? "—", icon: AlertOctagon, accent: "text-emergency" },
          { label: "Fleet total", value: k?.total ?? "—", icon: Ambulance, accent: "text-muted-foreground" },
        ].map((c) => (
          <div key={c.label} className="bg-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{c.label}</div>
              <c.icon className={`size-4 ${c.accent}`} />
            </div>
            <div className="text-3xl font-bold mono">{c.value}</div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-hairline bg-panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-hairline mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
            <span>Recent activity</span><span className="text-action">incident_events</span>
          </div>
          <div className="divide-y divide-hairline max-h-[420px] overflow-auto">
            {events.length === 0 && <div className="p-6 text-sm text-muted-foreground">No events yet.</div>}
            {events.map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="mono text-[10px] px-2 py-0.5 rounded bg-panel-elevated text-action uppercase tracking-widest">{e.event_type}</span>
                  <span className="mono text-xs text-muted-foreground truncate max-w-[260px]">{e.incident_id.slice(0, 8)}</span>
                </div>
                <span className="mono text-[11px] text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-hairline bg-panel p-4 space-y-2">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Jump to</div>
          {[
            { to: "/fleet", label: "Fleet management" },
            { to: "/dispatch", label: "Dispatch console" },
            { to: "/clinical", label: "Clinical workspace (HIS)" },
            { to: "/clinical-masters", label: "Clinical masters & DRG rates" },
            { to: "/compliance", label: "Compliance & maintenance" },
            { to: "/screening", label: "Mobile screening" },
            { to: "/training", label: "Training & certificates" },
            { to: "/audit", label: "Audit trail" },
            { to: "/developer", label: "API keys & webhooks" },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="block px-3 py-2 rounded-md hover:bg-panel-elevated text-sm border border-hairline">
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}