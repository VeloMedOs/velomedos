import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Ambulance as AmbulanceIcon, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fleet")({
  head: () => ({ meta: [{ title: "Fleet Management · VeloMed OS" }] }),
  component: Fleet,
});

type Vehicle = {
  id: string; code: string; type: string; status: string;
  home_base: string | null; current_lat: number | null; current_lng: number | null;
  last_ping_at: string | null; available_for_rent: boolean; daily_rate: number | null;
  driver_id: string | null;
};
type Credential = { id: string; kind: string; reference: string; expires_on: string; subject_user_id: string | null; subject_ambulance_id: string | null };
type Defect = { id: string; severity: string; blocks_service: boolean; description: string; resolved_at: string | null; created_at: string };
type WO = { id: string; type: string; status: string; opened_at: string; closed_at: string | null; odometer_km: number | null; downtime_minutes: number | null };
type Telemetry = { lat: number; lng: number; recorded_at: string; speed?: number | null; heading?: number | null };

const STATUS_COLOR: Record<string, string> = {
  available: "text-stable bg-stable/10 border-stable/30",
  dispatched: "text-action bg-action/10 border-action/30",
  en_route: "text-action bg-action/10 border-action/30",
  on_scene: "text-caution bg-caution/10 border-caution/30",
  transporting: "text-caution bg-caution/10 border-caution/30",
  out_of_service: "text-emergency bg-emergency/10 border-emergency/30",
  maintenance: "text-muted-foreground bg-panel-elevated border-hairline",
};

function Fleet() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [vCreds, setVCreds] = useState<Credential[]>([]);
  const [crewCreds, setCrewCreds] = useState<Credential[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [wos, setWos] = useState<WO[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [loadingDrawer, setLoadingDrawer] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("ambulances")
      .select("id,code,type,status,home_base,current_lat,current_lng,last_ping_at,available_for_rent,daily_rate,driver_id")
      .order("code")
      .then(({ data }) => setVehicles((data ?? []) as Vehicle[]));
  }, []);

  async function loadFromApi(id: string) {
    setLoadingDrawer(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session?.access_token) headers["authorization"] = `Bearer ${session.access_token}`;
      const get = (path: string) => fetch(`/api/public/v1${path}`, { headers }).then(async (r) => r.ok ? r.json() : null);
      const [loc, def, wo, cr] = await Promise.all([
        get(`/fleet/${id}/location`),
        get(`/vehicles/${id}/defects`),
        get(`/vehicles/${id}/work_orders`),
        get(`/vehicles/${id}/credentials`),
      ]);
      setTelemetry(loc as Telemetry | null);
      setDefects((def ?? []) as Defect[]);
      setWos((wo ?? []) as WO[]);
      setVCreds(((cr?.vehicle ?? []) as Credential[]));
      setCrewCreds(((cr?.crew ?? []) as Credential[]));
    } finally { setLoadingDrawer(false); }
  }

  useEffect(() => {
    if (!selected) return;
    loadFromApi(selected.id);
    const t = setInterval(() => loadFromApi(selected.id), 8000);
    return () => clearInterval(t);
  }, [selected]);

  const filtered = vehicles.filter((v) =>
    !q || v.code.toLowerCase().includes(q.toLowerCase()) || (v.home_base ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <main className="max-w-[1600px] mx-auto p-6 space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Fleet</div>
          <h1 className="text-2xl font-bold tracking-tight">Vehicles ({vehicles.length})</h1>
        </div>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or base…"
          className="h-9 w-64 px-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm"
        />
      </header>

      <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel-elevated mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Code</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Home base</th>
              <th className="text-left px-4 py-2.5">Last ping</th>
              <th className="text-left px-4 py-2.5">Rentable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {filtered.map((v) => (
              <tr key={v.id} onClick={() => setSelected(v)} className="hover:bg-panel-elevated cursor-pointer">
                <td className="px-4 py-2.5 mono font-semibold">{v.code}</td>
                <td className="px-4 py-2.5 mono text-xs uppercase">{v.type}</td>
                <td className="px-4 py-2.5">
                  <span className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${STATUS_COLOR[v.status] ?? ""}`}>
                    {v.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{v.home_base ?? "—"}</td>
                <td className="px-4 py-2.5 mono text-xs text-muted-foreground">
                  {v.last_ping_at ? new Date(v.last_ping_at).toLocaleTimeString() : "—"}
                </td>
                <td className="px-4 py-2.5 mono text-xs">{v.available_for_rent ? `$${v.daily_rate}/day` : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No vehicles.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <aside onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md h-full bg-panel border-l border-hairline overflow-y-auto">
            <div className="sticky top-0 bg-panel/95 backdrop-blur border-b border-hairline px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AmbulanceIcon className="size-4 text-action" />
                <span className="font-bold mono">{selected.code}</span>
                <span className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${STATUS_COLOR[selected.status] ?? ""}`}>
                  {selected.status.replace("_", " ")}
                </span>
                {loadingDrawer && <RefreshCw className="size-3 animate-spin text-muted-foreground" />}
              </div>
              <button onClick={() => setSelected(null)} className="size-7 rounded-md hover:bg-panel-elevated grid place-items-center"><X className="size-4" /></button>
            </div>
            <div className="p-5 space-y-5">
              <section>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Telemetry · GET /fleet/{`{id}`}/location</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-muted-foreground text-xs">Latitude</div><div className="mono">{telemetry?.lat?.toFixed(5) ?? selected.current_lat?.toFixed(5) ?? "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">Longitude</div><div className="mono">{telemetry?.lng?.toFixed(5) ?? selected.current_lng?.toFixed(5) ?? "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">Speed</div><div className="mono">{telemetry?.speed != null ? `${Math.round(telemetry.speed)} km/h` : "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">Last ping</div><div className="mono text-xs">{telemetry?.recorded_at ? new Date(telemetry.recorded_at).toLocaleTimeString() : "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">Home base</div><div>{selected.home_base ?? "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">Driver</div><div className="mono text-xs truncate">{selected.driver_id?.slice(0, 8) ?? "—"}</div></div>
                </div>
              </section>
              <section>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Vehicle credentials · GET /vehicles/{`{id}`}/credentials ({vCreds.length})</div>
                {vCreds.length === 0 && <div className="text-xs text-muted-foreground">No vehicle credentials on file.</div>}
                {vCreds.map((c) => {
                  const days = Math.floor((new Date(c.expires_on).getTime() - Date.now()) / 86_400_000);
                  const cls = days < 0 ? "text-emergency" : days < 30 ? "text-caution" : "text-stable";
                  return (
                    <div key={c.id} className="flex items-center justify-between py-1.5 text-sm border-b border-hairline last:border-0">
                      <div>
                        <div className="font-medium">{c.kind.replace(/_/g, " ")}</div>
                        <div className="mono text-xs text-muted-foreground">{c.reference}</div>
                      </div>
                      <div className={`mono text-xs ${cls}`}>{days < 0 ? `expired ${-days}d` : `${days}d`}</div>
                    </div>
                  );
                })}
                {crewCreds.length > 0 && (
                  <>
                    <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-3 mb-1">Crew credentials ({crewCreds.length})</div>
                    {crewCreds.map((c) => {
                      const days = Math.floor((new Date(c.expires_on).getTime() - Date.now()) / 86_400_000);
                      const cls = days < 0 ? "text-emergency" : days < 30 ? "text-caution" : "text-stable";
                      return (
                        <div key={c.id} className="flex items-center justify-between py-1.5 text-sm border-b border-hairline last:border-0">
                          <div>
                            <div className="font-medium">{c.kind.replace(/_/g, " ")}</div>
                            <div className="mono text-xs text-muted-foreground">{c.reference}</div>
                          </div>
                          <div className={`mono text-xs ${cls}`}>{days < 0 ? `expired ${-days}d` : `${days}d`}</div>
                        </div>
                      );
                    })}
                  </>
                )}
              </section>
              <section>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Defects · GET /vehicles/{`{id}`}/defects ({defects.length})</div>
                {defects.length === 0 && <div className="text-xs text-muted-foreground">None reported.</div>}
                {defects.map((d) => (
                  <div key={d.id} className="py-1.5 text-sm border-b border-hairline last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{d.description}</span>
                      <span className={`mono text-[10px] uppercase ${d.blocks_service && !d.resolved_at ? "text-emergency" : "text-muted-foreground"}`}>{d.severity}</span>
                    </div>
                    <div className="mono text-xs text-muted-foreground">{d.resolved_at ? "resolved" : "open"}</div>
                  </div>
                ))}
              </section>
              <section>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Work orders · GET /vehicles/{`{id}`}/work_orders ({wos.length})</div>
                {wos.length === 0 && <div className="text-xs text-muted-foreground">No history.</div>}
                {wos.map((w) => (
                  <div key={w.id} className="flex items-center justify-between py-1.5 text-sm border-b border-hairline last:border-0">
                    <div>
                      <div className="font-medium capitalize">{w.type}</div>
                      <div className="mono text-xs text-muted-foreground">{new Date(w.opened_at).toLocaleDateString()} · {w.downtime_minutes ?? 0}m downtime</div>
                    </div>
                    <span className="mono text-[10px] uppercase text-action">{w.status}</span>
                  </div>
                ))}
              </section>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}