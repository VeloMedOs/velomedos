import { ROUTE_COLOR } from "@/lib/brand";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapClient } from "@/components/MapClient";
import type { MapPolyline } from "@/components/LeafletMap";
import { decodePolyline } from "@/lib/polyline";

export const Route = createFileRoute("/_authenticated/trips")({
  head: () => ({ meta: [{ title: "Trip history · VeloMed OS" }] }),
  component: Trips,
});

type Trip = {
  id: string; resource_kind: string; resource_id: string; incident_id: string | null;
  started_at: string; ended_at: string | null;
  distance_km: number; duration_seconds: number;
  max_speed_kmh: number; avg_speed_kmh: number;
  polyline: string | null; status: string;
};

function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selected, setSelected] = useState<Trip | null>(null);
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    supabase
      .from("trips" as never)
      .select("*")
      .gte("started_at", new Date(from).toISOString())
      .lte("started_at", new Date(to + "T23:59:59").toISOString())
      .order("started_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setTrips((data ?? []) as Trip[]));
  }, [from, to]);

  const polylines: MapPolyline[] = selected?.polyline
    ? [{ id: selected.id, path: decodePolyline(selected.polyline), color: ROUTE_COLOR, width: 5 }]
    : [];

  return (
    <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4 h-[calc(100vh-3.5rem)]">
      <aside className="rounded-xl border border-hairline bg-panel overflow-hidden flex flex-col">
        <div className="p-3 border-b border-hairline">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Trip History</div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2 rounded bg-input border border-hairline text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2 rounded bg-input border border-hairline text-sm" />
          </div>
        </div>
        <div className="overflow-y-auto divide-y divide-hairline">
          {trips.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No trips in range.</div>}
          {trips.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)} className={`w-full text-left px-4 py-3 hover:bg-panel-elevated ${selected?.id === t.id ? "bg-panel-elevated" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{t.resource_kind} · {t.resource_id.slice(0, 8)}</span>
                <span className={`mono text-[10px] ${t.status === "completed" ? "text-stable" : t.status === "active" ? "text-action" : "text-muted-foreground"}`}>{t.status}</span>
              </div>
              <div className="mt-1 mono text-xs">{t.distance_km.toFixed(1)} km · {Math.round(t.duration_seconds / 60)} min · max {Math.round(t.max_speed_kmh)} km/h</div>
              <div className="mono text-[10px] text-muted-foreground mt-0.5">{new Date(t.started_at).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </aside>
      <div className="rounded-xl border border-hairline bg-panel overflow-hidden relative">
        <MapClient polylines={polylines} className="absolute inset-0" />
        {!selected && <div className="absolute inset-0 grid place-items-center pointer-events-none mono text-[11px] uppercase tracking-widest text-muted-foreground">Select a trip to replay</div>}
      </div>
    </main>
  );
}