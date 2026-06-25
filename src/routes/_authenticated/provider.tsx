import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crosshair, Ambulance, CircleCheck, Clock, Activity } from "lucide-react";
import { formatElapsed } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/provider")({ component: Provider });

type Amb = {
  id: string; code: string; type: string; status: string;
  current_lat: number | null; current_lng: number | null;
};
type Inc = {
  id: string; code: string; severity: string; status: string;
  address: string | null; symptoms: string | null;
  pickup_lat: number | null; pickup_lng: number | null;
  patient_name: string | null; created_at: string;
  assigned_ambulance_id: string | null;
};

const LIFECYCLE = ["assigned", "en_route", "on_scene", "transporting", "completed"] as const;

function Provider() {
  const [units, setUnits] = useState<Amb[]>([]);
  const [activeAmbId, setActiveAmbId] = useState<string | null>(null);
  const [job, setJob] = useState<Inc | null>(null);
  const [sharing, setSharing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [vitals, setVitals] = useState({ bp: "", hr: "", spo2: "" });
  const [notes, setNotes] = useState("");
  const watchRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);

  async function load() {
    const { data } = await supabase
      .from("ambulances")
      .select("id,code,type,status,current_lat,current_lng")
      .order("code");
    if (data) {
      setUnits(data as Amb[]);
      if (!activeAmbId && data.length) setActiveAmbId(data[0].id);
    }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!activeAmbId) return;
    refreshJob();
    const ch = supabase
      .channel(`provider-${activeAmbId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents", filter: `assigned_ambulance_id=eq.${activeAmbId}` }, refreshJob)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAmbId]);

  async function refreshJob() {
    if (!activeAmbId) return;
    const { data } = await supabase
      .from("incidents")
      .select("id,code,severity,status,address,symptoms,pickup_lat,pickup_lng,patient_name,created_at,assigned_ambulance_id")
      .eq("assigned_ambulance_id", activeAmbId)
      .not("status", "in", "(completed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setJob(data as Inc | null);
  }

  function startSharing() {
    if (!navigator.geolocation) return toast.error("Geolocation unavailable");
    if (!activeAmbId) return;
    setSharing(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }),
      (err) => toast.error(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
    tickerRef.current = window.setInterval(async () => {
      if (!coordsRef.current || !activeAmbId) return;
      const c = coordsRef.current;
      await Promise.all([
        supabase.from("ambulance_locations").insert({ ambulance_id: activeAmbId, lat: c.lat, lng: c.lng }),
        supabase.from("ambulances").update({ current_lat: c.lat, current_lng: c.lng, last_ping_at: new Date().toISOString() }).eq("id", activeAmbId),
      ]);
    }, 5000);
  }
  // keep ref in sync
  const coordsRef = useRef<typeof coords>(null);
  useEffect(() => { coordsRef.current = coords; }, [coords]);

  function stopSharing() {
    setSharing(false);
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    if (tickerRef.current != null) clearInterval(tickerRef.current);
    watchRef.current = null; tickerRef.current = null;
  }
  useEffect(() => () => stopSharing(), []);

  async function advance() {
    if (!job) return;
    const idx = LIFECYCLE.indexOf(job.status as typeof LIFECYCLE[number]);
    const next = LIFECYCLE[Math.min(idx + 1, LIFECYCLE.length - 1)];
    await supabase.from("incidents").update({ status: next, notes: notes || null }).eq("id", job.id);
    if (next === "completed" && activeAmbId) {
      await supabase.from("ambulances").update({ status: "available" }).eq("id", activeAmbId);
      stopSharing();
    } else if (activeAmbId) {
      const ambStatus = next === "transporting" ? "transporting" : next === "on_scene" ? "on_scene" : "en_route";
      await supabase.from("ambulances").update({ status: ambStatus }).eq("id", activeAmbId);
    }
    await supabase.from("incident_events").insert({ incident_id: job.id, event_type: next, payload: { vitals, notes } });
    toast.success(`Status → ${next.replace("_", " ")}`);
  }

  const active = units.find((u) => u.id === activeAmbId);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {/* Unit selector */}
      <div className="rounded-lg border border-hairline bg-panel p-3">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Active unit</div>
        <select value={activeAmbId ?? ""} onChange={(e) => setActiveAmbId(e.target.value)} className="w-full h-10 px-3 rounded-md bg-input border border-hairline text-sm">
          {units.map((u) => <option key={u.id} value={u.id}>{u.code} · {u.type} · {u.status}</option>)}
        </select>
      </div>

      {/* Live location */}
      <div className="rounded-lg border border-hairline bg-panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">GPS Telemetry</div>
            <div className="text-sm font-semibold flex items-center gap-2">
              {sharing ? <><span className="size-2 rounded-full bg-stable animate-pulse" /> Streaming · 5s</> : <><span className="size-2 rounded-full bg-muted-foreground" /> Offline</>}
            </div>
          </div>
          <button onClick={sharing ? stopSharing : startSharing} className={`px-4 py-2 rounded-md mono text-[10px] uppercase tracking-widest font-bold ${sharing ? "bg-emergency text-emergency-foreground" : "bg-action text-action-foreground"}`}>
            {sharing ? "Stop" : "Share Live"}
          </button>
        </div>
        {coords && (
          <div className="mt-3 grid grid-cols-3 gap-2 mono text-[11px]">
            <Telem label="LAT" value={coords.lat.toFixed(5)} />
            <Telem label="LNG" value={coords.lng.toFixed(5)} />
            <Telem label="±m" value={coords.acc.toFixed(0)} />
          </div>
        )}
      </div>

      {/* Job card */}
      {job ? (
        <div className="rounded-lg border border-emergency/40 bg-emergency/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-emergency">{job.severity.toUpperCase().replace("_", " ")}</div>
            <div className="mono text-[10px] text-muted-foreground">{job.code} · {formatElapsed(job.created_at)}</div>
          </div>
          <div>
            <div className="text-base font-semibold">{job.patient_name ?? "Patient"}</div>
            <div className="text-sm text-muted-foreground">{job.address ?? "Pickup pending"}</div>
          </div>
          {job.symptoms && <div className="text-xs text-muted-foreground border-t border-hairline pt-2">{job.symptoms}</div>}

          {/* Timeline */}
          <div className="flex items-center gap-1 mono text-[9px] uppercase tracking-widest">
            {LIFECYCLE.map((s, i) => {
              const cur = LIFECYCLE.indexOf(job.status as typeof LIFECYCLE[number]);
              const done = i <= cur;
              return (
                <div key={s} className="flex-1">
                  <div className={`h-1 rounded ${done ? "bg-action" : "bg-hairline"}`} />
                  <div className={`mt-1 truncate ${done ? "text-action" : "text-muted-foreground"}`}>{s.replace("_", " ")}</div>
                </div>
              );
            })}
          </div>

          {/* Vitals */}
          <div className="grid grid-cols-3 gap-2">
            <Input label="BP" value={vitals.bp} onChange={(v) => setVitals({ ...vitals, bp: v })} placeholder="120/80" />
            <Input label="HR" value={vitals.hr} onChange={(v) => setVitals({ ...vitals, hr: v })} placeholder="72" />
            <Input label="SpO2" value={vitals.spo2} onChange={(v) => setVitals({ ...vitals, spo2: v })} placeholder="98" />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Patient notes…" rows={2} className="w-full px-3 py-2 rounded-md bg-input border border-hairline text-sm" />

          <button onClick={advance} className="w-full h-12 rounded-md bg-action text-action-foreground mono text-xs uppercase tracking-widest font-bold hover:bg-action/90 flex items-center justify-center gap-2">
            {job.status === "transporting" ? <><CircleCheck className="size-4" /> Hospital Handoff</> : <>Advance → {LIFECYCLE[Math.min(LIFECYCLE.indexOf(job.status as typeof LIFECYCLE[number]) + 1, LIFECYCLE.length - 1)].replace("_", " ")}</>}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-hairline bg-panel p-8 text-center">
          <Ambulance className="size-8 text-muted-foreground mx-auto mb-3" />
          <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">{active?.status === "available" ? "Standing by · awaiting dispatch" : "No active job"}</div>
        </div>
      )}
    </div>
  );
}

function Telem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-panel-elevated px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-0.5 w-full h-9 px-2 rounded bg-input border border-hairline text-sm" />
    </label>
  );
}