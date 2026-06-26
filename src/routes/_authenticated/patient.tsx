import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GoogleMap } from "@/components/GoogleMap";
import type { MapMarker, MapPolyline } from "@/components/LeafletMap";
import { toast } from "sonner";
import { Crosshair, Hospital, Calendar, Video, ShieldCheck, AlertTriangle, GraduationCap, Activity, ClipboardList } from "lucide-react";
import { haversineKm, formatElapsed } from "@/lib/distance";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { computeRouteEta } from "@/lib/maps.functions";
import { getCareHistory, listTelehealthClinics, type CareEpisode } from "@/lib/patient.functions";
import { decodePolyline } from "@/lib/polyline";

export const Route = createFileRoute("/_authenticated/patient")({ component: Patient });

type Inc = {
  id: string; code: string; severity: string; status: string;
  address: string | null; pickup_lat: number | null; pickup_lng: number | null;
  assigned_ambulance_id: string | null; created_at: string;
};
type Amb = { id: string; code: string; type: string; current_lat: number | null; current_lng: number | null; driver_id: string | null };
type Clinic = { id: string; name: string; address: string | null; lat?: number | null; lng?: number | null; specialties: string[] | null };

function Patient() {
  const [tab, setTab] = useState<"now" | "care" | "history">("now");
  const [activeInc, setActiveInc] = useState<Inc | null>(null);
  const [history, setHistory] = useState<Inc[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);

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
    setActiveInc(rows.find((r) => !["completed", "cancelled"].includes(r.status)) ?? null);
  }

  useEffect(() => {
    supabase.from("clinics").select("id,name,address,specialties").order("name").then(({ data }) => data && setClinics(data as Clinic[]));
    refreshMine();
  }, []);

  // Refresh active incident on any change to user's incidents
  useEffect(() => {
    const ch = supabase.channel("patient-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => refreshMine())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-24">
      <div className="grid grid-cols-3 gap-1 p-1 bg-panel rounded-lg border border-hairline mono text-[10px] uppercase tracking-widest">
        {(["now", "care", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`h-9 rounded ${tab === t ? "bg-panel-elevated text-foreground" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "now" && (activeInc
        ? <LiveNow inc={activeInc} onCancel={async () => { await supabase.from("incidents").update({ status: "cancelled" }).eq("id", activeInc.id); refreshMine(); }} />
        : <RequestForm onCreated={refreshMine} />
      )}

      {tab === "care" && <CareTab clinics={clinics} />}
      {tab === "history" && <HistoryTab incidents={history} />}
    </div>
  );
}

/* -------------------------- NOW: live ambulance tracking -------------------------- */

const STATUS_TIMELINE = ["pending", "assigned", "en_route", "on_scene", "transporting", "at_hospital", "completed"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  en_route: "En route",
  on_scene: "On scene",
  transporting: "Transporting",
  at_hospital: "At hospital",
  completed: "Completed",
};

type IncEvent = { id: string; kind: string; payload: any; actor_id: string | null; created_at: string };

function LiveNow({ inc, onCancel }: { inc: Inc; onCancel: () => void }) {
  const [amb, setAmb] = useState<Amb | null>(null);
  const [events, setEvents] = useState<IncEvent[]>([]);
  const [eta, setEta] = useState<{ km: number; mins: number; polyline: string | null } | null>(null);
  const lastStatusRef = useRef<string>(inc.status);
  const computeEta = useServerFn(computeRouteEta);

  // Ambulance fetch + realtime location
  useEffect(() => {
    const id = inc.assigned_ambulance_id;
    if (!id) { setAmb(null); return; }
    supabase.from("ambulances").select("id,code,type,current_lat,current_lng,driver_id").eq("id", id).single()
      .then(({ data }) => data && setAmb(data as Amb));
    const ch = supabase
      .channel(`patient-amb-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ambulance_locations", filter: `ambulance_id=eq.${id}` }, (payload) => {
        const row = payload.new as { lat: number; lng: number };
        setAmb((prev) => prev ? { ...prev, current_lat: row.lat, current_lng: row.lng } : prev);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [inc.assigned_ambulance_id]);

  // Driver first name
  const [driverName, setDriverName] = useState<string | null>(null);
  useEffect(() => {
    if (!amb?.driver_id) { setDriverName(null); return; }
    // profiles may be self-only; fall back to anonymized label.
    supabase.from("profiles").select("full_name").eq("id", amb.driver_id).maybeSingle()
      .then(({ data }) => setDriverName((data?.full_name ?? "Crew").split(" ")[0]));
  }, [amb?.driver_id]);

  // Incident events timeline
  useEffect(() => {
    supabase.from("incident_events").select("id, kind, payload, actor_id, created_at").eq("incident_id", inc.id).order("created_at")
      .then(({ data }) => setEvents((data ?? []) as IncEvent[]));
    const ch = supabase
      .channel(`patient-inc-${inc.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_events", filter: `incident_id=eq.${inc.id}` }, (payload) => {
        setEvents((prev) => [...prev, payload.new as IncEvent]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [inc.id]);

  // Push in-app banner on status change
  useEffect(() => {
    if (inc.status === lastStatusRef.current) return;
    lastStatusRef.current = inc.status;
    const label = STATUS_LABEL[inc.status] ?? inc.status;
    toast(`Status update · ${label}`, { description: `Your incident ${inc.code} is now ${label.toLowerCase()}.` });
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try { new Notification("VeloMed", { body: `${inc.code} · ${label}` }); } catch { /* ignore */ }
    }
  }, [inc.status, inc.code]);

  // Road ETA via Google Routes — refresh when ambulance moves materially
  const lastEtaKey = useRef<string>("");
  useEffect(() => {
    if (!amb?.current_lat || !amb?.current_lng || inc.pickup_lat == null || inc.pickup_lng == null) return;
    const key = `${amb.current_lat.toFixed(3)}|${amb.current_lng.toFixed(3)}`;
    if (key === lastEtaKey.current) return;
    lastEtaKey.current = key;
    computeEta({ data: { origin: { lat: amb.current_lat, lng: amb.current_lng }, destination: { lat: inc.pickup_lat, lng: inc.pickup_lng } } })
      .then((r) => setEta({ km: r.distance_km, mins: Math.round((r.duration_seconds ?? 0) / 60), polyline: r.polyline }))
      .catch(() => undefined);
  }, [amb?.current_lat, amb?.current_lng, inc.pickup_lat, inc.pickup_lng, computeEta]);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (inc.pickup_lat != null) m.push({ id: "p", lat: inc.pickup_lat, lng: inc.pickup_lng!, variant: "patient", label: "You" });
    if (amb?.current_lat != null) m.push({ id: "a", lat: amb.current_lat, lng: amb.current_lng!, variant: "ambulance", label: amb.code, pulse: true });
    return m;
  }, [amb?.current_lat, amb?.current_lng, amb?.code, inc.pickup_lat, inc.pickup_lng]);

  const polylines = useMemo<MapPolyline[]>(() => {
    if (!eta?.polyline) return [];
    const path = decodePolyline(eta.polyline);
    return [{ id: "route", path, color: "#3b9eff", width: 4 }];
  }, [eta?.polyline]);

  const km = (amb?.current_lat != null && inc.pickup_lat != null)
    ? haversineKm({ lat: inc.pickup_lat, lng: inc.pickup_lng! }, { lat: amb.current_lat, lng: amb.current_lng! }) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-action/40 bg-action/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">{STATUS_LABEL[inc.status] ?? inc.status}</div>
            <div className="text-lg font-bold">
              {amb ? <>Unit {amb.code}{driverName ? <span className="text-muted-foreground font-normal text-sm"> · {driverName}</span> : null}</> : "Awaiting assignment"}
            </div>
          </div>
          <div className="text-right">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">ETA</div>
            <div className="mono text-2xl font-bold">{eta ? `${eta.mins}m` : km != null ? `~${Math.max(1, Math.round((km / 50) * 60))}m` : "—"}</div>
            {eta && <div className="mono text-[10px] text-muted-foreground">{eta.km} km · road</div>}
          </div>
        </div>
        <div className="mt-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">Elapsed {formatElapsed(inc.created_at)} · {inc.code}</div>
      </div>

      <div className="h-72 rounded-lg overflow-hidden border border-hairline">
        <GoogleMap markers={markers} polylines={polylines} className="h-full w-full" center={inc.pickup_lat ? [inc.pickup_lat, inc.pickup_lng!] : undefined} fitToMarkers={markers.length > 1} />
      </div>

      <Timeline currentStatus={inc.status} events={events} />

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => Notification?.requestPermission?.()} className="h-10 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel-elevated">Enable alerts</button>
        <button onClick={onCancel} className="h-10 rounded-md border border-emergency/40 text-emergency mono text-[10px] uppercase tracking-widest hover:bg-emergency/10">Cancel request</button>
      </div>
    </div>
  );
}

function Timeline({ currentStatus, events }: { currentStatus: string; events: IncEvent[] }) {
  const reachedIdx = STATUS_TIMELINE.indexOf(currentStatus as typeof STATUS_TIMELINE[number]);
  return (
    <div className="rounded-lg border border-hairline bg-panel p-4">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">Status timeline</div>
      <ol className="space-y-2">
        {STATUS_TIMELINE.map((s, i) => {
          const reached = i <= reachedIdx && reachedIdx >= 0;
          const current = s === currentStatus;
          return (
            <li key={s} className="flex items-center gap-3">
              <span className={`size-2.5 rounded-full ${reached ? (current ? "bg-action animate-pulse" : "bg-stable") : "bg-muted/30"}`} />
              <span className={`text-sm ${current ? "font-semibold" : reached ? "text-foreground" : "text-muted-foreground"}`}>{STATUS_LABEL[s]}</span>
            </li>
          );
        })}
      </ol>
      {events.length > 0 && (
        <details className="mt-3">
          <summary className="mono text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer">Crew updates · {events.length}</summary>
          <ul className="mt-2 space-y-1.5">
            {events.slice().reverse().slice(0, 10).map((e) => (
              <li key={e.id} className="text-xs text-muted-foreground">
                <span className="mono text-[10px] text-action mr-2">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="capitalize">{e.kind.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* -------------------------- Request form -------------------------- */

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
      const sla = ({ code_red: 8, code_yellow: 20, routine: 60 } as Record<string, number>)[form.severity] ?? 30;
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
      <div className="grid grid-cols-2 gap-2">
        <Link to="/screening" className="rounded-lg border border-hairline bg-panel p-3 hover:bg-panel-elevated">
          <div className="flex items-center gap-2"><ClipboardList className="size-4 text-action" /><span className="font-semibold text-sm">Book screening</span></div>
          <div className="text-[11px] text-muted-foreground mt-1">Fit-for-duty & medicals</div>
        </Link>
        <Link to="/training" className="rounded-lg border border-hairline bg-panel p-3 hover:bg-panel-elevated">
          <div className="flex items-center gap-2"><GraduationCap className="size-4 text-action" /><span className="font-semibold text-sm">Training</span></div>
          <div className="text-[11px] text-muted-foreground mt-1">Courses & certifications</div>
        </Link>
      </div>
    </div>
  );
}

/* -------------------------- CARE: telehealth + clinics -------------------------- */

type Booking = {
  id: string; clinic_id: string; slot_at: string; reason: string | null;
  status: string; kind: string;
};
type Session = { id: string; booking_id: string; room_id: string; status: string };

function CareTab({ clinics }: { clinics: Clinic[] }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [me, setMe] = useState<string | null>(null);

  async function refresh() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data: b } = await supabase.from("clinic_bookings").select("id,clinic_id,slot_at,reason,status,kind").eq("patient_id", user.id).order("slot_at", { ascending: false });
    setBookings((b ?? []) as Booking[]);
    const ids = (b ?? []).map((x) => x.id);
    if (ids.length) {
      const { data: s } = await supabase.from("telehealth_sessions").select("id,booking_id,room_id,status").in("booking_id", ids);
      setSessions((s ?? []) as Session[]);
    } else setSessions([]);
  }
  useEffect(() => { refresh(); }, []);

  const sessByBooking = useMemo(() => new Map(sessions.map((s) => [s.booking_id, s])), [sessions]);
  const now = Date.now();
  const upcoming = bookings.filter((b) => b.kind === "telehealth" && new Date(b.slot_at).getTime() > now - 60 * 60 * 1000 && b.status !== "cancelled");
  const past = bookings.filter((b) => b.kind === "telehealth" && (new Date(b.slot_at).getTime() <= now - 60 * 60 * 1000 || b.status === "cancelled" || b.status === "completed"));
  const clinicById = useMemo(() => new Map(clinics.map((c) => [c.id, c])), [clinics]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-action/30 bg-action/5 p-4">
        <div className="flex items-center gap-2"><Video className="size-4 text-action" /><div className="font-semibold">Telehealth</div></div>
        <div className="text-xs text-muted-foreground mt-0.5">Schedule a remote visit with a clinician. Join from this page at appointment time.</div>
      </div>

      <BookTelehealth clinics={clinics} onBooked={refresh} me={me} />

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Upcoming · {upcoming.length}</div>
          {upcoming.map((b) => {
            const s = sessByBooking.get(b.id);
            return <TelehealthCard key={b.id} booking={b} session={s} clinic={clinicById.get(b.clinic_id) ?? null} onChanged={refresh} />;
          })}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Past</div>
          {past.slice(0, 5).map((b) => {
            const s = sessByBooking.get(b.id);
            return <TelehealthCard key={b.id} booking={b} session={s} clinic={clinicById.get(b.clinic_id) ?? null} onChanged={refresh} readOnly />;
          })}
        </section>
      )}

      <section className="space-y-2">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Book in-person clinic visit</div>
        <InPersonBooking clinics={clinics} onBooked={refresh} />
      </section>
    </div>
  );
}

function TelehealthCard({ booking, session, clinic, onChanged, readOnly = false }:
  { booking: Booking; session: Session | undefined; clinic: Clinic | null; onChanged: () => void; readOnly?: boolean }) {
  const slot = new Date(booking.slot_at);
  const now = Date.now();
  const joinable = !readOnly && session && booking.status !== "cancelled"
    && slot.getTime() - now < 10 * 60 * 1000 && now - slot.getTime() < 60 * 60 * 1000;
  const [editingSlot, setEditingSlot] = useState<string | null>(null);

  async function cancel() {
    if (!confirm("Cancel this telehealth appointment?")) return;
    await supabase.from("clinic_bookings").update({ status: "cancelled" }).eq("id", booking.id);
    if (session) await supabase.from("telehealth_sessions").update({ status: "cancelled" }).eq("id", session.id);
    onChanged();
    toast.success("Appointment cancelled");
  }
  async function reschedule() {
    if (!editingSlot) return;
    const iso = new Date(editingSlot).toISOString();
    await supabase.from("clinic_bookings").update({ slot_at: iso }).eq("id", booking.id);
    setEditingSlot(null);
    onChanged();
    toast.success("Rescheduled");
  }
  function join() {
    if (!session?.room_id) return;
    toast.success("Joining session…", { description: `Room ${session.room_id}` });
    // Placeholder: real video room will replace this URL pattern.
    window.open(`https://meet.velomed.health/${encodeURIComponent(session.room_id)}`, "_blank", "noopener");
  }

  return (
    <div className="rounded-lg border border-hairline bg-panel p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-sm">{clinic?.name ?? "Clinic"}</div>
          <div className="text-[11px] text-muted-foreground">{slot.toLocaleString()}</div>
          {booking.reason && <div className="text-xs mt-1">{booking.reason}</div>}
        </div>
        <span className={`mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${booking.status === "cancelled" ? "bg-muted/20 text-muted-foreground" : booking.status === "completed" ? "bg-stable/15 text-stable" : "bg-action/15 text-action"}`}>{booking.status}</span>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {joinable && <button onClick={join} className="h-9 px-3 rounded-md bg-action text-action-foreground mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1.5"><Video className="size-3.5" /> Join</button>}
          {booking.status !== "cancelled" && (
            <>
              {editingSlot === null
                ? <button onClick={() => setEditingSlot(booking.slot_at.slice(0, 16))} className="h-9 px-3 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel-elevated">Reschedule</button>
                : (
                  <div className="flex gap-1 items-center">
                    <input type="datetime-local" value={editingSlot} onChange={(e) => setEditingSlot(e.target.value)} className="h-9 px-2 rounded bg-input border border-hairline text-xs" />
                    <button onClick={reschedule} className="h-9 px-3 rounded-md bg-action text-action-foreground mono text-[10px] uppercase tracking-widest">Save</button>
                    <button onClick={() => setEditingSlot(null)} className="h-9 px-2 rounded-md border border-hairline mono text-[10px] uppercase">×</button>
                  </div>
                )}
              <button onClick={cancel} className="h-9 px-3 rounded-md border border-emergency/40 text-emergency mono text-[10px] uppercase tracking-widest hover:bg-emergency/10">Cancel</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BookTelehealth({ clinics, onBooked, me }: { clinics: Clinic[]; onBooked: () => void; me: string | null }) {
  const [clinicId, setClinicId] = useState<string>("");
  const [slot, setSlot] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Mock available slots derived from the clinic id + day so the same clinic shows stable slots.
  const slots = useMemo(() => {
    const base = new Date(); base.setHours(9, 0, 0, 0); base.setDate(base.getDate() + 1);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(base); d.setHours(9 + Math.floor(i * 1.5));
      return d.toISOString().slice(0, 16);
    });
  }, []);

  async function book() {
    if (!me) return toast.error("Sign in required");
    if (!clinicId) return toast.error("Pick a clinic");
    setBusy(true);
    try {
      const { data: b, error } = await supabase.from("clinic_bookings")
        .insert({ patient_id: me, clinic_id: clinicId, slot_at: new Date(slot).toISOString(), reason: reason || null, kind: "telehealth" })
        .select("id").single();
      if (error) throw error;
      const room = `vm-${b!.id.slice(0, 8)}`;
      const { error: e2 } = await supabase.from("telehealth_sessions").insert({ booking_id: b!.id, room_id: room, status: "scheduled" });
      if (e2) throw e2;
      toast.success("Telehealth appointment scheduled");
      setReason("");
      onBooked();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-hairline bg-panel p-4 space-y-3">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">New telehealth visit</div>
      <Field label="Remote clinic">
        <select value={clinicId} onChange={(e) => setClinicId(e.target.value)} className="w-full h-10 px-2 rounded bg-input border border-hairline text-sm">
          <option value="">Select a clinic…</option>
          {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Available slots">
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map((s) => (
            <button key={s} onClick={() => setSlot(s)} className={`h-9 rounded mono text-[10px] border ${slot === s ? "bg-action/10 border-action/60 text-action" : "border-hairline text-muted-foreground hover:bg-panel-elevated"}`}>
              {new Date(s).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Or pick a custom time">
        <input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full h-10 px-3 rounded bg-input border border-hairline text-sm" />
      </Field>
      <Field label="Reason">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2 rounded bg-input border border-hairline text-sm" placeholder="e.g. follow-up, prescription renewal" />
      </Field>
      <button onClick={book} disabled={busy || !clinicId} className="w-full h-11 rounded-md bg-action text-action-foreground mono text-xs uppercase tracking-widest font-bold disabled:opacity-60">
        {busy ? "Scheduling…" : "Schedule Telehealth Visit"}
      </button>
    </div>
  );
}

function InPersonBooking({ clinics, onBooked }: { clinics: Clinic[]; onBooked: () => void }) {
  const [clinicId, setClinicId] = useState<string>("");
  const [slot, setSlot] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [reason, setReason] = useState("");

  async function book() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !clinicId) return;
    const { error } = await supabase.from("clinic_bookings").insert({
      patient_id: user.id, clinic_id: clinicId, slot_at: new Date(slot).toISOString(), reason: reason || null, kind: "in_person",
    });
    if (error) return toast.error(error.message);
    toast.success("Visit requested");
    onBooked();
  }
  return (
    <div className="rounded-lg border border-hairline bg-panel p-4 space-y-3">
      <Field label="Clinic">
        <select value={clinicId} onChange={(e) => setClinicId(e.target.value)} className="w-full h-10 px-2 rounded bg-input border border-hairline text-sm">
          <option value="">Select…</option>
          {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Date & time"><input type="datetime-local" value={slot} onChange={(e) => setSlot(e.target.value)} className="w-full h-10 px-3 rounded bg-input border border-hairline text-sm" /></Field>
      <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-10 px-3 rounded bg-input border border-hairline text-sm" /></Field>
      <button onClick={book} disabled={!clinicId} className="w-full h-10 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest hover:bg-panel-elevated disabled:opacity-60">Confirm in-person visit</button>
    </div>
  );
}

/* -------------------------- HISTORY: credentialed care -------------------------- */

function HistoryTab({ incidents: _incidents }: { incidents: Inc[] }) {
  const fetchHistory = useServerFn(getCareHistory);
  const q = useQuery({
    queryKey: ["patient", "care-history"],
    queryFn: () => fetchHistory(),
  });

  if (q.isLoading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading care history…</div>;
  if (q.error) return <div className="p-6 text-center text-sm text-emergency">{(q.error as Error).message}</div>;
  const eps = q.data?.episodes ?? [];
  if (eps.length === 0) return <div className="p-6 text-center text-sm text-muted-foreground">No care episodes yet</div>;

  return (
    <div className="space-y-3">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Credentialed care history · {eps.length}</div>
      {eps.map((e) => <EpisodeCard key={`${e.kind}-${e.id}`} ep={e} />)}
    </div>
  );
}

function EpisodeCard({ ep }: { ep: CareEpisode }) {
  const Icon = ep.kind === "incident" ? Activity : ep.kind === "telehealth" ? Video : ep.kind === "screening" ? ClipboardList : GraduationCap;
  const title =
    ep.kind === "incident" ? `Incident ${ep.code}` :
    ep.kind === "telehealth" ? `Telehealth · ${ep.clinic_name ?? "Clinic"}` :
    ep.kind === "screening" ? `Screening · ${ep.test}` :
    `Certificate · ${ep.course_title ?? ep.code}`;
  const subtitle =
    ep.kind === "incident" ? `${ep.unit_code ? `Unit ${ep.unit_code} · ` : ""}${ep.status.replace(/_/g, " ")}${ep.address ? ` · ${ep.address}` : ""}` :
    ep.kind === "telehealth" ? `${ep.status}${ep.reason ? ` · ${ep.reason}` : ""}` :
    ep.kind === "screening" ? `${ep.outcome ?? ""} · Fitness ${ep.fitness_status}` :
    `Code ${ep.code}`;
  return (
    <div className="rounded-lg border border-hairline bg-panel p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Icon className="size-4 text-action mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{title}</div>
          <div className="text-[11px] text-muted-foreground">{new Date(ep.at).toLocaleString()}</div>
          <div className="text-xs mt-1 capitalize">{subtitle}</div>
        </div>
      </div>
      {"provider" in ep && ep.provider && <ProviderBadge provider={ep.provider} />}
      {ep.kind === "incident" && ep.events.length > 0 && (
        <details>
          <summary className="mono text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer">Event timeline · {ep.events.length}</summary>
          <ul className="mt-2 space-y-1">
            {ep.events.map((e) => (
              <li key={e.id} className="text-[11px] text-muted-foreground">
                <span className="mono text-action mr-2">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="capitalize">{e.kind.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {ep.kind === "telehealth" && ep.notes && (
        <div className="text-xs border-l-2 border-hairline pl-2 text-muted-foreground"><span className="mono text-[10px] uppercase mr-1">Provider notes:</span>{ep.notes}</div>
      )}
    </div>
  );
}

function ProviderBadge({ provider }: { provider: NonNullable<CareEpisode extends { provider: infer P } ? P : never> }) {
  const anyValid = provider.credentials.some((c) => c.valid_at_time);
  const noCreds = provider.credentials.length === 0;
  return (
    <div className="rounded-md border border-hairline bg-panel-elevated/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className={`size-4 shrink-0 ${anyValid ? "text-stable" : "text-caution"}`} />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">{provider.full_name ?? "Provider"}</div>
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{provider.role ?? "credentialed"}</div>
          </div>
        </div>
        <span className={`mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${noCreds ? "bg-muted/20 text-muted-foreground" : anyValid ? "bg-stable/15 text-stable" : "bg-caution/15 text-caution"}`}>
          {noCreds ? "On file" : anyValid ? "Valid at time" : <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" /> Expired</span>}
        </span>
      </div>
      {provider.credentials.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {provider.credentials.slice(0, 3).map((c, i) => (
            <span key={i} className={`mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${c.valid_at_time ? "border-stable/40 text-stable" : "border-caution/40 text-caution"}`}>
              {c.kind}{c.reference ? ` ${c.reference}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>{children}</label>;
}