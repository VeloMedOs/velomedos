import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ambulance, CircleCheck, ShieldAlert, AlertTriangle, Check, X, Stethoscope, FileText, Hospital } from "lucide-react";
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
type Cred = { id: string; kind: string; reference: string; expires_on: string };
type HistoryRow = { id: string; code: string; severity: string; status: string; created_at: string; address: string | null };

const LIFECYCLE = ["assigned", "en_route", "on_scene", "transporting", "completed"] as const;

function Provider() {
  const [units, setUnits] = useState<Amb[]>([]);
  const [activeAmbId, setActiveAmbId] = useState<string | null>(null);
  const [job, setJob] = useState<Inc | null>(null);
  const [sharing, setSharing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [vitals, setVitals] = useState({ bp: "", hr: "", spo2: "" });
  const [notes, setNotes] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [creds, setCreds] = useState<Cred[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [oosOpen, setOosOpen] = useState(false);
  const [oosReason, setOosReason] = useState("");
  const watchRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);
  const coordsRef = useRef<typeof coords>(null);
  useEffect(() => { coordsRef.current = coords; }, [coords]);

  async function load() {
    const { data } = await supabase.from("ambulances").select("id,code,type,status,current_lat,current_lng").order("code");
    if (data) {
      setUnits(data as Amb[]);
      setActiveAmbId((prev) => prev ?? (data[0]?.id ?? null));
    }
  }

  useEffect(() => {
    load();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data: c } = await supabase
        .from("credentials")
        .select("id,kind,reference,expires_on")
        .eq("subject_user_id", uid)
        .order("expires_on");
      setCreds((c ?? []) as Cred[]);
    });
  }, []);

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

  async function refreshHistory() {
    if (!activeAmbId) return;
    const { data } = await supabase
      .from("incidents")
      .select("id,code,severity,status,address,created_at")
      .eq("assigned_ambulance_id", activeAmbId)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(15);
    setHistory((data ?? []) as HistoryRow[]);
  }

  useEffect(() => {
    if (!activeAmbId) return;
    refreshJob();
    refreshHistory();
    const ch = supabase
      .channel(`provider-${activeAmbId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents", filter: `assigned_ambulance_id=eq.${activeAmbId}` }, () => { refreshJob(); refreshHistory(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ambulances", filter: `id=eq.${activeAmbId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAmbId]);

  const today = new Date().toISOString().slice(0, 10);
  const expiredCreds = creds.filter((c) => c.expires_on < today);
  const expiringSoon = creds.filter((c) => {
    const d = (new Date(c.expires_on).getTime() - Date.now()) / 86_400_000;
    return d >= 0 && d <= 30;
  });
  const blocked = expiredCreds.length > 0;

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

  function stopSharing() {
    setSharing(false);
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    if (tickerRef.current != null) clearInterval(tickerRef.current);
    watchRef.current = null; tickerRef.current = null;
  }
  useEffect(() => () => stopSharing(), []);

  async function logEvent(event_type: string, payload: Record<string, unknown> = {}) {
    if (!job) return;
    await supabase.from("incident_events").insert({
      incident_id: job.id,
      event_type,
      payload: { ...payload, actor_id: userId } as never,
    });
  }

  async function accept() {
    if (!job || blocked) return;
    await supabase.from("incidents").update({ status: "en_route" }).eq("id", job.id);
    if (activeAmbId) await supabase.from("ambulances").update({ status: "en_route" }).eq("id", activeAmbId);
    await logEvent("accepted");
    toast.success("Job accepted");
  }

  async function decline() {
    if (!job) return;
    const reason = window.prompt("Decline reason?") ?? "";
    if (!reason.trim()) return;
    await logEvent("declined", { reason });
    await supabase.from("incidents").update({ status: "pending", assigned_ambulance_id: null }).eq("id", job.id);
    if (activeAmbId) await supabase.from("ambulances").update({ status: "available" }).eq("id", activeAmbId);
    toast.message("Job returned to dispatch");
  }

  async function abort() {
    if (!job) return;
    const reason = window.prompt("Abort reason?") ?? "";
    if (!reason.trim()) return;
    await logEvent("aborted", { reason });
    await supabase.from("incidents").update({ status: "cancelled" }).eq("id", job.id);
    if (activeAmbId) await supabase.from("ambulances").update({ status: "available" }).eq("id", activeAmbId);
    stopSharing();
    refreshHistory();
    toast.message("Job aborted");
  }

  async function quickAction(kind: "vitals" | "note" | "handoff") {
    if (kind === "vitals") {
      if (!vitals.bp && !vitals.hr && !vitals.spo2) return toast.error("Enter at least one vital");
      await logEvent("vitals", { vitals });
      toast.success("Vitals logged");
    } else if (kind === "note") {
      if (!notes.trim()) return toast.error("Empty note");
      await logEvent("note", { notes });
      setNotes("");
      toast.success("Note logged");
    } else {
      await logEvent("hospital_handoff", { notes, vitals });
      toast.success("Handoff recorded");
    }
  }

  async function setUnitStatus(next: "available" | "out_of_service", reason?: string) {
    if (!activeAmbId) return;
    await supabase.from("ambulances").update({ status: next }).eq("id", activeAmbId);
    if (next === "out_of_service" && reason) {
      await supabase.from("defects").insert({ vehicle_id: activeAmbId, description: reason, severity: "minor" as never });
    }
    setOosOpen(false); setOosReason("");
    toast.success(`Unit ${next.replace("_", " ")}`);
  }

  async function advance() {
    if (!job) return;
    const idx = LIFECYCLE.indexOf(job.status as typeof LIFECYCLE[number]);
    const next = LIFECYCLE[Math.min(idx + 1, LIFECYCLE.length - 1)];
    await supabase.from("incidents").update({ status: next, notes: notes || null }).eq("id", job.id);
    if (next === "completed" && activeAmbId) {
      await supabase.from("ambulances").update({ status: "available" }).eq("id", activeAmbId);
      stopSharing();
      refreshHistory();
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
      {blocked ? (
        <div className="rounded-lg border border-emergency/60 bg-emergency/10 p-3 flex items-start gap-2">
          <ShieldAlert className="size-4 text-emergency mt-0.5" />
          <div className="text-xs">
            <div className="mono uppercase tracking-widest text-emergency font-bold">Credential expired</div>
            <div className="text-muted-foreground">{expiredCreds.map((c) => `${c.kind} ${c.reference}`).join(", ")} — accepting new jobs is blocked.</div>
          </div>
        </div>
      ) : expiringSoon.length > 0 ? (
        <div className="rounded-lg border border-caution/60 bg-caution/10 p-3 flex items-start gap-2">
          <AlertTriangle className="size-4 text-caution mt-0.5" />
          <div className="text-xs">
            <div className="mono uppercase tracking-widest text-caution font-bold">Credential expiring</div>
            <div className="text-muted-foreground">{expiringSoon.map((c) => `${c.kind} · ${c.expires_on}`).join(", ")}</div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-hairline bg-panel p-3">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Active unit</div>
        <select value={activeAmbId ?? ""} onChange={(e) => setActiveAmbId(e.target.value)} className="w-full h-10 px-3 rounded-md bg-input border border-hairline text-sm">
          {units.map((u) => <option key={u.id} value={u.id}>{u.code} · {u.type} · {u.status}</option>)}
        </select>
        {active && (
          <div className="mt-2 flex gap-2">
            <button onClick={() => setUnitStatus("available")} disabled={active.status === "available"} className="flex-1 h-8 rounded mono text-[10px] uppercase tracking-widest bg-stable/15 text-stable border border-stable/40 disabled:opacity-40">Available</button>
            <button onClick={() => setOosOpen((v) => !v)} className="flex-1 h-8 rounded mono text-[10px] uppercase tracking-widest bg-muted/30 border border-hairline">Out of service</button>
          </div>
        )}
        {oosOpen && (
          <div className="mt-2 space-y-2">
            <input value={oosReason} onChange={(e) => setOosReason(e.target.value)} placeholder="Reason (e.g. mechanical)" className="w-full h-9 px-2 rounded bg-input border border-hairline text-sm" />
            <button disabled={!oosReason.trim()} onClick={() => setUnitStatus("out_of_service", oosReason.trim())} className="w-full h-9 rounded mono text-[10px] uppercase tracking-widest bg-emergency text-emergency-foreground disabled:opacity-40">Confirm OOS</button>
          </div>
        )}
      </div>

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

          <div className="grid grid-cols-3 gap-2">
            <Input label="BP" value={vitals.bp} onChange={(v) => setVitals({ ...vitals, bp: v })} placeholder="120/80" />
            <Input label="HR" value={vitals.hr} onChange={(v) => setVitals({ ...vitals, hr: v })} placeholder="72" />
            <Input label="SpO2" value={vitals.spo2} onChange={(v) => setVitals({ ...vitals, spo2: v })} placeholder="98" />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Patient notes…" rows={2} className="w-full px-3 py-2 rounded-md bg-input border border-hairline text-sm" />

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => quickAction("vitals")} className="h-9 rounded bg-panel-elevated border border-hairline mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Stethoscope className="size-3.5" />Vitals</button>
            <button onClick={() => quickAction("note")} className="h-9 rounded bg-panel-elevated border border-hairline mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><FileText className="size-3.5" />Note</button>
            <button onClick={() => quickAction("handoff")} className="h-9 rounded bg-panel-elevated border border-hairline mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1"><Hospital className="size-3.5" />Handoff</button>
          </div>

          {job.status === "assigned" ? (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={decline} className="h-12 rounded-md bg-muted/30 border border-hairline mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2"><X className="size-4" />Decline</button>
              <button onClick={accept} disabled={blocked} className="h-12 rounded-md bg-stable text-stable-foreground mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 disabled:opacity-40"><Check className="size-4" />Accept</button>
            </div>
          ) : (
            <button onClick={advance} className="w-full h-12 rounded-md bg-action text-action-foreground mono text-xs uppercase tracking-widest font-bold hover:bg-action/90 flex items-center justify-center gap-2">
              {job.status === "transporting" ? <><CircleCheck className="size-4" /> Hospital Handoff</> : <>Advance → {LIFECYCLE[Math.min(LIFECYCLE.indexOf(job.status as typeof LIFECYCLE[number]) + 1, LIFECYCLE.length - 1)].replace("_", " ")}</>}
            </button>
          )}
          <button onClick={abort} className="w-full h-9 rounded-md border border-emergency/40 text-emergency mono text-[10px] uppercase tracking-widest font-bold">Abort job</button>
        </div>
      ) : (
        <div className="rounded-lg border border-hairline bg-panel p-8 text-center">
          <Ambulance className="size-8 text-muted-foreground mx-auto mb-3" />
          <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">{active?.status === "available" ? "Standing by · awaiting dispatch" : "No active job"}</div>
        </div>
      )}

      <div className="rounded-lg border border-hairline bg-panel p-3">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Job history · this unit</div>
        {history.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No past jobs.</div>
        ) : (
          <ul className="divide-y divide-hairline">
            {history.map((h) => (
              <li key={h.id} className="py-2 flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{h.code} · {h.severity.replace("_", " ")}</div>
                  <div className="text-muted-foreground truncate">{h.address ?? "—"}</div>
                </div>
                <div className={`mono text-[10px] uppercase tracking-widest ${h.status === "completed" ? "text-stable" : "text-muted-foreground"}`}>{h.status}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
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
