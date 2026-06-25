import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapClient } from "@/components/MapClient";
import type { MapMarker } from "@/components/LeafletMap";
import { toast } from "sonner";
import { Crosshair, Phone, Hospital, Calendar } from "lucide-react";
import { haversineKm, etaMinutes, formatElapsed } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/patient")({ component: Patient });

type Inc = {
  id: string; code: string; severity: string; status: string;
  address: string | null; pickup_lat: number | null; pickup_lng: number | null;
  assigned_ambulance_id: string | null; created_at: string;
};
type Amb = { id: string; code: string; type: string; current_lat: number | null; current_lng: number | null };
type Clinic = { id: string; name: string; address: string | null; lat: number | null; lng: number | null; specialties: string[] | null };

function Patient() {
  const [tab, setTab] = useState<"request" | "clinics" | "history">("request");
  const [activeInc, setActiveInc] = useState<Inc | null>(null);
  const [amb, setAmb] = useState<Amb | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [history, setHistory] = useState<Inc[]>([]);

  useEffect(() => {
    supabase.from("clinics").select("id,name,address,lat,lng,specialties").then(({ data }) => data && setClinics(data as Clinic[]));
    refreshMine();
  }, []);

  async function refreshMine() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("incidents")
      .select("id,code,severity,status,address,pickup_lat,pickup_lng,assigned_ambulance_id,created_at")
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Inc[];
    setHistory(rows);
    const active = rows.find((r) => !["completed", "cancelled"].includes(r.status)) ?? null;
    setActiveInc(active);
  }

  useEffect(() => {
    if (!activeInc?.assigned_ambulance_id) { setAmb(null); return; }
    const id = activeInc.assigned_ambulance_id;
    supabase.from("ambulances").select("id,code,type,current_lat,current_lng").eq("id", id).single().then(({ data }) => data && setAmb(data as Amb));
    const ch = supabase
      .channel(`patient-amb-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ambulance_locations", filter: `ambulance_id=eq.${id}` }, (payload) => {
        const row = payload.new as { lat: number; lng: number };
        setAmb((prev) => prev ? { ...prev, current_lat: row.lat, current_lng: row.lng } : prev);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "incidents", filter: `id=eq.${activeInc.id}` }, refreshMine)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeInc?.assigned_ambulance_id, activeInc?.id]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="grid grid-cols-3 gap-1 p-1 bg-panel rounded-lg border border-hairline mono text-[10px] uppercase tracking-widest">
        {(["request", "clinics", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`h-8 rounded ${tab === t ? "bg-panel-elevated text-foreground" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "request" && (activeInc ? (
        <LiveEta inc={activeInc} amb={amb} onCancel={async () => {
          await supabase.from("incidents").update({ status: "cancelled" }).eq("id", activeInc.id);
          refreshMine();
        }} />
      ) : (
        <RequestForm onCreated={refreshMine} />
      ))}

      {tab === "clinics" && <ClinicTab clinics={clinics} />}
      {tab === "history" && <HistoryTab history={history} />}
    </div>
  );
}

function RequestForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ address: "", lat: 40.758, lng: -73.985, severity: "code_yellow", symptoms: "", phone: "" });
  const [busy, setBusy] = useState(false);

  function detect() {
    if (!navigator.geolocation) return toast.error("Geolocation unavailable");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })); toast.success("Location detected"); },
      (e) => toast.error(e.message),
    );
  }

  async function submit() {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const sla = { code_red: 8, code_yellow: 20, routine: 60 }[form.severity];
      const { error } = await supabase.from("incidents").insert({
        requested_by: user?.id ?? null,
        caller_phone: form.phone || null,
        address: form.address || null,
        pickup_lat: form.lat, pickup_lng: form.lng,
        severity: form.severity as "code_red" | "code_yellow" | "routine",
        symptoms: form.symptoms || null,
        sla_target_at: new Date(Date.now() + sla * 60_000).toISOString(),
      });
      if (error) throw error;
      toast.success("Help is on the way");
      onCreated();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emergency/40 bg-emergency/5 p-5 text-center">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-emergency">Emergency?</div>
        <h2 className="text-2xl font-bold mt-1">Request an ambulance</h2>
        <p className="text-xs text-muted-foreground mt-1">A unit will be dispatched the moment a controller assigns it.</p>
      </div>
      <div className="space-y-3 rounded-lg border border-hairline bg-panel p-4">
        <div className="grid grid-cols-3 gap-2">
          {(["code_red", "code_yellow", "routine"] as const).map((s) => (
            <button key={s} onClick={() => setForm({ ...form, severity: s })} className={`h-12 rounded-md mono text-[10px] uppercase tracking-widest border ${form.severity === s ? (s === "code_red" ? "bg-emergency/10 text-emergency border-emergency/60" : s === "code_yellow" ? "bg-caution/10 text-caution border-caution/60" : "bg-action/10 text-action border-action/60") : "border-hairline text-muted-foreground"}`}>
              {s.replace("code_", "").replace("_", " ")}
            </button>
          ))}
        </div>
        <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Callback number" className="w-full h-10 px-3 rounded bg-input border border-hairline text-sm" /></Field>
        <Field label="Address"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address or landmark" className="w-full h-10 px-3 rounded bg-input border border-hairline text-sm" /></Field>
        <div className="flex gap-2 items-end">
          <Field label="Coordinates">
            <div className="mono text-[11px] text-muted-foreground">{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</div>
          </Field>
          <button onClick={detect} className="h-9 px-3 rounded border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel-elevated inline-flex items-center gap-1.5"><Crosshair className="size-3.5" /> Detect</button>
        </div>
        <Field label="What's happening?"><textarea value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} rows={3} className="w-full px-3 py-2 rounded bg-input border border-hairline text-sm" /></Field>
        <button onClick={submit} disabled={busy} className="w-full h-12 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold hover:bg-emergency/90 disabled:opacity-60">
          {busy ? "Requesting…" : "Request Ambulance"}
        </button>
      </div>
    </div>
  );
}

function LiveEta({ inc, amb, onCancel }: { inc: Inc; amb: Amb | null; onCancel: () => void }) {
  const km = (amb?.current_lat != null && inc.pickup_lat != null) ? haversineKm({ lat: inc.pickup_lat, lng: inc.pickup_lng! }, { lat: amb.current_lat, lng: amb.current_lng! }) : null;
  const markers: MapMarker[] = [];
  if (inc.pickup_lat != null) markers.push({ id: "p", lat: inc.pickup_lat, lng: inc.pickup_lng!, variant: "patient", label: "You" });
  if (amb?.current_lat != null) markers.push({ id: "a", lat: amb.current_lat, lng: amb.current_lng!, variant: "ambulance", label: amb.code, pulse: true });
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-action/40 bg-action/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">{inc.status.replace("_", " ")}</div>
            <div className="text-lg font-bold">{amb ? `${amb.code} en route` : "Awaiting assignment"}</div>
          </div>
          <div className="text-right">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">ETA</div>
            <div className="mono text-2xl font-bold">{km != null ? `${etaMinutes(km)}m` : "—"}</div>
          </div>
        </div>
        <div className="mt-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">Elapsed {formatElapsed(inc.created_at)} · {inc.code}</div>
      </div>
      <div className="h-72 rounded-lg overflow-hidden border border-hairline">
        <MapClient markers={markers} className="h-full w-full" center={inc.pickup_lat ? [inc.pickup_lat, inc.pickup_lng!] : undefined} />
      </div>
      <button onClick={onCancel} className="w-full h-10 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel-elevated">Cancel request</button>
    </div>
  );
}

function ClinicTab({ clinics }: { clinics: Clinic[] }) {
  const [selected, setSelected] = useState<Clinic | null>(null);
  const [slot, setSlot] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [reason, setReason] = useState("");
  async function book() {
    if (!selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("clinic_bookings").insert({
      patient_id: user.id, clinic_id: selected.id, slot_at: new Date(slot).toISOString(), reason: reason || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Booking requested");
    setSelected(null);
  }
  return (
    <div className="space-y-3">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Remote clinics · {clinics.length}</div>
      {clinics.map((c) => (
        <div key={c.id} className="rounded-lg border border-hairline bg-panel p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold flex items-center gap-2"><Hospital className="size-4 text-action" />{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.address}</div>
            </div>
          </div>
          {c.specialties && (
            <div className="flex flex-wrap gap-1">
              {c.specialties.map((s) => <span key={s} className="mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-panel-elevated text-muted-foreground">{s}</span>)}
            </div>
          )}
          <button onClick={() => setSelected(c)} className="mono text-[10px] uppercase tracking-widest text-action hover:underline">Book a visit →</button>
        </div>
      ))}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-end md:place-items-center" onClick={() => setSelected(null)}>
          <div className="w-full md:max-w-md bg-panel border border-hairline rounded-t-xl md:rounded-xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Booking</div>
            <h3 className="text-lg font-bold">{selected.name}</h3>
            <Field label="Date & time"><input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full h-10 px-3 rounded bg-input border border-hairline text-sm" /></Field>
            <Field label="Reason"><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded bg-input border border-hairline text-sm" /></Field>
            <button onClick={book} className="w-full h-11 rounded-md bg-action text-action-foreground mono text-xs uppercase tracking-widest font-bold">Confirm Booking</button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ history }: { history: Inc[] }) {
  if (history.length === 0) return <div className="text-center text-sm text-muted-foreground p-6">No previous requests</div>;
  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.id} className="rounded-lg border border-hairline bg-panel p-3">
          <div className="flex items-center justify-between mono text-[10px] uppercase tracking-widest">
            <span className="text-muted-foreground">{h.code}</span>
            <span className={h.status === "completed" ? "text-stable" : h.status === "cancelled" ? "text-muted-foreground" : "text-action"}>{h.status.replace("_", " ")}</span>
          </div>
          <div className="text-sm mt-1">{h.address ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(h.created_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>{children}</label>;
}