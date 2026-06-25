import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapClient } from "@/components/MapClient";
import type { MapMarker } from "@/components/LeafletMap";
import { Plus, Radio, Crosshair, ShieldAlert, Activity, X } from "lucide-react";
import { toast } from "sonner";
import { haversineKm, etaMinutes, formatElapsed } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/dispatch")({ component: Dispatch });

type Ambulance = {
  id: string; code: string; type: string; status: string;
  current_lat: number | null; current_lng: number | null; home_base: string | null;
};
type Incident = {
  id: string; code: string; severity: string; status: string;
  caller_name: string | null; address: string | null;
  pickup_lat: number | null; pickup_lng: number | null;
  symptoms: string | null; sla_target_at: string | null;
  assigned_ambulance_id: string | null; created_at: string;
};

const SEV_LABEL: Record<string, string> = { code_red: "CODE RED", code_yellow: "CODE YELLOW", routine: "ROUTINE" };
const SEV_COLOR: Record<string, string> = { code_red: "text-emergency border-emergency/60 bg-emergency/10", code_yellow: "text-caution border-caution/60 bg-caution/10", routine: "text-action border-action/60 bg-action/10" };
const STATUS_COLOR: Record<string, string> = {
  available: "text-stable", en_route: "text-action",
  on_scene: "text-caution", transporting: "text-caution",
  out_of_service: "text-muted-foreground",
};

function Dispatch() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<Incident | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    const [a, i] = await Promise.all([
      supabase.from("ambulances").select("id,code,type,status,current_lat,current_lng,home_base").order("code"),
      supabase.from("incidents").select("id,code,severity,status,caller_name,address,pickup_lat,pickup_lng,symptoms,sla_target_at,assigned_ambulance_id,created_at").order("created_at", { ascending: false }).limit(40),
    ]);
    if (a.data) setAmbulances(a.data as Ambulance[]);
    if (i.data) setIncidents(i.data as Incident[]);
  }
  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("dispatch")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ambulances" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ambulance_locations" }, (payload) => {
        const row = payload.new as { ambulance_id: string; lat: number; lng: number };
        setAmbulances((prev) => prev.map((a) => a.id === row.ambulance_id ? { ...a, current_lat: row.lat, current_lng: row.lng } : a));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    for (const a of ambulances) {
      if (a.current_lat == null || a.current_lng == null) continue;
      out.push({
        id: `amb-${a.id}`, lat: a.current_lat, lng: a.current_lng,
        label: `${a.code} · ${a.type} · ${a.status}`,
        variant: "ambulance",
        pulse: a.status === "en_route" || a.status === "on_scene",
      });
    }
    for (const i of incidents) {
      if (i.status === "completed" || i.status === "cancelled") continue;
      if (i.pickup_lat == null || i.pickup_lng == null) continue;
      out.push({
        id: `inc-${i.id}`, lat: i.pickup_lat, lng: i.pickup_lng,
        label: `${i.code} · ${SEV_LABEL[i.severity]}`,
        variant: "incident", pulse: i.severity === "code_red" && i.status === "pending",
      });
    }
    return out;
  }, [ambulances, incidents]);

  const kpis = useMemo(() => {
    const total = ambulances.length;
    const avail = ambulances.filter((a) => a.status === "available").length;
    const active = ambulances.filter((a) => ["en_route", "on_scene", "transporting"].includes(a.status)).length;
    const utilization = total ? Math.round((active / total) * 100) : 0;
    const open = incidents.filter((i) => !["completed", "cancelled"].includes(i.status)).length;
    const pending = incidents.filter((i) => i.status === "pending").length;
    return { total, avail, active, utilization, open, pending };
  }, [ambulances, incidents]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] h-[calc(100vh-3.5rem)]">
      {/* MAP + KPIs */}
      <div className="relative">
        <MapClient markers={markers} className="absolute inset-0" />
        <div className="absolute top-3 left-3 right-3 z-10 grid grid-cols-2 md:grid-cols-5 gap-2 pointer-events-none">
          <Kpi label="Fleet" value={`${kpis.avail}/${kpis.total}`} sub="available" />
          <Kpi label="Active" value={String(kpis.active)} sub="en-route / scene" />
          <Kpi label="Open Calls" value={String(kpis.open)} sub={`${kpis.pending} pending`} />
          <Kpi label="Utilization" value={`${kpis.utilization}%`} sub="fleet load" />
          <Kpi label="System" value="LIVE" sub="realtime channel" accent="text-stable" />
        </div>
        <button
          onClick={() => setIntakeOpen(true)}
          className="absolute bottom-6 right-6 z-10 inline-flex items-center gap-2 px-5 py-3 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold shadow-[0_0_24px_oklch(0.62_0.22_27/0.5)] hover:bg-emergency/90"
        >
          <Plus className="size-4" /> New Incident
        </button>
      </div>

      {/* SIDEBAR */}
      <aside className="border-l border-hairline bg-panel flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Incident Queue</div>
            <div className="text-sm font-semibold">{kpis.open} active</div>
          </div>
          <Radio className="size-4 text-action animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {incidents.length === 0 && (
            <div className="p-6 text-center mono text-[11px] uppercase tracking-widest text-muted-foreground">No incidents · standing by</div>
          )}
          {incidents.map((i) => {
            const closed = i.status === "completed" || i.status === "cancelled";
            const amb = ambulances.find((a) => a.id === i.assigned_ambulance_id);
            return (
              <div key={i.id} className={`px-4 py-3 border-b border-hairline ${closed ? "opacity-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className={`px-1.5 py-0.5 rounded border mono text-[9px] tracking-[0.18em] ${SEV_COLOR[i.severity] ?? ""}`}>
                    {SEV_LABEL[i.severity]}
                  </span>
                  <span className="mono text-[10px] text-muted-foreground">{i.code}</span>
                </div>
                <div className="mt-1.5 text-sm truncate">{i.address ?? "Location pending"}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{i.symptoms ?? "—"}</div>
                <div className="mt-2 flex items-center justify-between mono text-[10px] uppercase tracking-widest">
                  <span className={STATUS_COLOR[i.status] ?? "text-muted-foreground"}>{i.status.replace("_", " ")}</span>
                  <span className="text-muted-foreground">{formatElapsed(i.created_at)} <span className="opacity-50">/{tick && ""}</span></span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {amb ? (
                    <span className="mono text-[10px] text-action">→ {amb.code}</span>
                  ) : (
                    <span className="mono text-[10px] text-muted-foreground">unassigned</span>
                  )}
                  {!closed && i.status === "pending" && (
                    <button onClick={() => setAssignFor(i)} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-action text-action-foreground font-bold hover:bg-action/90">
                      Assign
                    </button>
                  )}
                  {!closed && i.assigned_ambulance_id && (
                    <button
                      onClick={async () => {
                        await supabase.from("incidents").update({ status: "completed" }).eq("id", i.id);
                        await supabase.from("ambulances").update({ status: "available" }).eq("id", i.assigned_ambulance_id!);
                      }}
                      className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {intakeOpen && <IntakeDrawer onClose={() => setIntakeOpen(false)} onCreated={refresh} />}
      {assignFor && (
        <AssignDrawer
          incident={assignFor}
          ambulances={ambulances.filter((a) => a.status === "available" && a.current_lat != null)}
          onClose={() => setAssignFor(null)}
          onAssigned={refresh}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="pointer-events-auto rounded-md border border-hairline bg-panel/90 backdrop-blur px-3 py-2">
      <div className="mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className={`mono text-lg font-bold ${accent ?? ""}`}>{value}</div>
      <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">{sub}</div>
    </div>
  );
}

function IntakeDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    caller_name: "", caller_phone: "", patient_name: "",
    address: "", pickup_lat: 40.758, pickup_lng: -73.985,
    severity: "code_yellow", symptoms: "",
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const sla = { code_red: 8, code_yellow: 20, routine: 60 }[form.severity] ?? 30;
      const { error } = await supabase.from("incidents").insert({
        caller_name: form.caller_name || null,
        caller_phone: form.caller_phone || null,
        patient_name: form.patient_name || null,
        address: form.address || null,
        pickup_lat: form.pickup_lat,
        pickup_lng: form.pickup_lng,
        severity: form.severity as "code_red" | "code_yellow" | "routine",
        symptoms: form.symptoms || null,
        sla_target_at: new Date(Date.now() + sla * 60_000).toISOString(),
      });
      if (error) throw error;
      toast.success("Incident broadcast");
      onCreated();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-panel border-l border-hairline overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-panel border-b border-hairline p-4 flex items-center justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-emergency">New Incident</div>
            <h3 className="text-lg font-bold">Intake</h3>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded hover:bg-panel-elevated"><X className="size-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Severity">
            <div className="grid grid-cols-3 gap-2">
              {(["code_red", "code_yellow", "routine"] as const).map((s) => (
                <button key={s} onClick={() => setForm({ ...form, severity: s })} className={`h-10 rounded mono text-[10px] uppercase tracking-widest border ${form.severity === s ? SEV_COLOR[s] : "border-hairline text-muted-foreground hover:bg-panel-elevated"}`}>
                  {SEV_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Caller name"><Input value={form.caller_name} onChange={(v) => setForm({ ...form, caller_name: v })} /></Field>
          <Field label="Caller phone"><Input value={form.caller_phone} onChange={(v) => setForm({ ...form, caller_phone: v })} /></Field>
          <Field label="Patient"><Input value={form.patient_name} onChange={(v) => setForm({ ...form, patient_name: v })} /></Field>
          <Field label="Pickup address"><Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lat"><Input value={String(form.pickup_lat)} onChange={(v) => setForm({ ...form, pickup_lat: Number(v) || 0 })} /></Field>
            <Field label="Lng"><Input value={String(form.pickup_lng)} onChange={(v) => setForm({ ...form, pickup_lng: Number(v) || 0 })} /></Field>
          </div>
          <Field label="Symptoms / notes">
            <textarea value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm" />
          </Field>
          <button onClick={submit} disabled={busy} className="w-full h-11 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold hover:bg-emergency/90 disabled:opacity-60">
            {busy ? "Broadcasting…" : "Broadcast Incident"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignDrawer({ incident, ambulances, onClose, onAssigned }: {
  incident: Incident; ambulances: Ambulance[]; onClose: () => void; onAssigned: () => void;
}) {
  const ranked = useMemo(() => {
    if (incident.pickup_lat == null || incident.pickup_lng == null) return [];
    return ambulances
      .map((a) => ({ a, km: haversineKm({ lat: incident.pickup_lat!, lng: incident.pickup_lng! }, { lat: a.current_lat!, lng: a.current_lng! }) }))
      .sort((x, y) => x.km - y.km);
  }, [ambulances, incident]);

  async function assign(amb: Ambulance) {
    const { error } = await supabase.from("incidents").update({
      assigned_ambulance_id: amb.id, status: "assigned",
    }).eq("id", incident.id);
    if (error) return toast.error(error.message);
    await supabase.from("ambulances").update({ status: "en_route" }).eq("id", amb.id);
    toast.success(`${amb.code} dispatched`);
    onAssigned();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-panel border-l border-hairline overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-panel border-b border-hairline p-4 flex items-center justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Assign Unit</div>
            <h3 className="text-lg font-bold">{incident.code}</h3>
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded hover:bg-panel-elevated"><X className="size-4" /></button>
        </div>
        <div className="p-4 space-y-2">
          {ranked.length === 0 && <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground">No available units with GPS fix</div>}
          {ranked.map(({ a, km }) => (
            <button key={a.id} onClick={() => assign(a)} className="w-full text-left px-3 py-3 rounded-md border border-hairline bg-panel-elevated/40 hover:bg-panel-elevated transition-colors">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{a.code} <span className="mono text-[10px] text-muted-foreground ml-1">{a.type}</span></div>
                <div className="mono text-[10px] text-action">{km.toFixed(1)} km · ~{etaMinutes(km)}m</div>
              </div>
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{a.home_base ?? "—"}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-9 px-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm" />;
}