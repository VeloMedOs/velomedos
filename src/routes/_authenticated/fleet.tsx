import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Ambulance as AmbulanceIcon } from "lucide-react";

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
type Credential = { id: string; kind: string; reference: string; expires_on: string; subject_ambulance_id: string | null };
type Defect = { id: string; vehicle_id: string; severity: string; blocks_service: boolean; description: string; resolved_at: string | null };
type WO = { id: string; vehicle_id: string; type: string; status: string; opened_at: string; closed_at: string | null };

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
  const [creds, setCreds] = useState<Credential[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [wos, setWos] = useState<WO[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("ambulances")
      .select("id,code,type,status,home_base,current_lat,current_lng,last_ping_at,available_for_rent,daily_rate,driver_id")
      .order("code")
      .then(({ data }) => setVehicles((data ?? []) as Vehicle[]));
  }, []);

  useEffect(() => {
    if (!selected) return;
    Promise.all([
      supabase.from("credentials").select("id,kind,reference,expires_on,subject_ambulance_id").eq("subject_ambulance_id", selected.id),
      supabase.from("defects").select("id,vehicle_id,severity,blocks_service,description,resolved_at").eq("vehicle_id", selected.id).order("created_at", { ascending: false }),
      supabase.from("work_orders").select("id,vehicle_id,type,status,opened_at,closed_at").eq("vehicle_id", selected.id).order("opened_at", { ascending: false }),
    ]).then(([c, d, w]) => {
      setCreds((c.data ?? []) as Credential[]);
      setDefects((d.data ?? []) as Defect[]);
      setWos((w.data ?? []) as WO[]);
    });
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
              </div>
              <button onClick={() => setSelected(null)} className="size-7 rounded-md hover:bg-panel-elevated grid place-items-center"><X className="size-4" /></button>
            </div>
            <div className="p-5 space-y-5">
              <section>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Telemetry</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-muted-foreground text-xs">Latitude</div><div className="mono">{selected.current_lat?.toFixed(5) ?? "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">Longitude</div><div className="mono">{selected.current_lng?.toFixed(5) ?? "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">Home base</div><div>{selected.home_base ?? "—"}</div></div>
                  <div><div className="text-muted-foreground text-xs">Driver</div><div className="mono text-xs truncate">{selected.driver_id?.slice(0, 8) ?? "—"}</div></div>
                </div>
              </section>
              <section>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Credentials ({creds.length})</div>
                {creds.length === 0 && <div className="text-xs text-muted-foreground">No credentials on file.</div>}
                {creds.map((c) => {
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
              </section>
              <section>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Defects ({defects.length})</div>
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
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Work orders ({wos.length})</div>
                {wos.length === 0 && <div className="text-xs text-muted-foreground">No history.</div>}
                {wos.map((w) => (
                  <div key={w.id} className="flex items-center justify-between py-1.5 text-sm border-b border-hairline last:border-0">
                    <div>
                      <div className="font-medium capitalize">{w.type}</div>
                      <div className="mono text-xs text-muted-foreground">{new Date(w.opened_at).toLocaleDateString()}</div>
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