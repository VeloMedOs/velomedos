import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapClient } from "@/components/MapClient";
import type { MapMarker, MapPolyline } from "@/components/LeafletMap";
import { decodePolyline } from "@/lib/polyline";
import { Activity, Radio } from "lucide-react";

export const Route = createFileRoute("/trip/$token")({
  head: () => ({ meta: [{ title: "Live trip · VeloMed OS" }, { name: "robots", content: "noindex" }] }),
  component: TripShare,
});

type Snapshot = {
  trip: { id: string; resource_kind: string; status: string; started_at: string; ended_at: string | null; distance_km: number; duration_seconds: number; max_speed_kmh: number; avg_speed_kmh: number; polyline: string | null };
  current: { lat: number; lng: number; speed_kmh: number | null; recorded_at: string } | null;
  pickup: { lat: number; lng: number } | null;
  address: string | null;
  expires_at: string;
  error?: string;
};

function TripShare() {
  const { token } = Route.useParams();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch(`/api/public/v1/share/${token}`);
        const body = await res.json();
        if (!res.ok) { setError(body.error ?? "Trip unavailable"); return; }
        if (!cancelled) setSnap(body);
      } catch (e) { setError((e as Error).message); }
    }
    tick();
    const t = setInterval(tick, 4000);
    return () => { cancelled = true; clearInterval(t); };
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center">
          <Activity className="size-8 text-emergency mx-auto mb-3" />
          <div className="text-lg font-semibold">{error}</div>
          <div className="text-xs text-muted-foreground mt-2">This live tracking link is no longer active.</div>
        </div>
      </div>
    );
  }
  if (!snap) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading live trip…</div>;

  const markers: MapMarker[] = [];
  if (snap.current) markers.push({ id: "unit", lat: snap.current.lat, lng: snap.current.lng, variant: snap.trip.resource_kind === "vehicle" ? "ambulance" : (snap.trip.resource_kind as "paramedic" | "doctor"), pulse: snap.trip.status === "active", label: `${Math.round(snap.current.speed_kmh ?? 0)} km/h` });
  if (snap.pickup) markers.push({ id: "dest", lat: snap.pickup.lat, lng: snap.pickup.lng, variant: "patient", label: "Destination" });
  const polylines: MapPolyline[] = snap.trip.polyline ? [{ id: "route", path: decodePolyline(snap.trip.polyline), color: "#3b9eff", width: 5 }] : [];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="px-5 py-3 border-b border-hairline bg-panel flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-emergency grid place-items-center text-emergency-foreground"><Activity className="size-4" /></div>
          <span className="font-bold">VELOMED <span className="text-emergency">LIVE</span></span>
        </div>
        <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-stable">
          <Radio className="size-3.5 animate-pulse" /> Live tracking · {snap.trip.status}
        </div>
      </header>
      <div className="grid grid-cols-3 gap-px bg-hairline border-b border-hairline">
        <Stat label="Speed" value={`${Math.round(snap.current?.speed_kmh ?? 0)} km/h`} />
        <Stat label="Distance" value={`${snap.trip.distance_km.toFixed(1)} km`} />
        <Stat label="Elapsed" value={`${Math.floor((snap.trip.duration_seconds || (Date.now() - new Date(snap.trip.started_at).getTime()) / 1000) / 60)}m`} />
      </div>
      <div className="flex-1 relative">
        <MapClient markers={markers} polylines={polylines} fitToMarkers className="absolute inset-0" />
      </div>
      <footer className="px-5 py-2 text-center mono text-[10px] uppercase tracking-widest text-muted-foreground bg-panel border-t border-hairline">
        Read-only · expires {new Date(snap.expires_at).toLocaleString()}
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-3 py-2">
      <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mono text-base font-bold">{value}</div>
    </div>
  );
}