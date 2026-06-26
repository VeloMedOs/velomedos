import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Radio, ArrowRightLeft, X, Clock, Filter } from "lucide-react";
import { haversineKm, etaMinutes, formatElapsed } from "@/lib/distance";

export const Route = createFileRoute("/_authenticated/call-center")({ component: CallCenter });

type Ambulance = {
  id: string; code: string; type: string; status: string;
  current_lat: number | null; current_lng: number | null; home_base: string | null;
};
type Incident = {
  id: string; code: string; severity: string; status: string;
  caller_name: string | null; caller_phone: string | null; patient_name: string | null;
  address: string | null; pickup_lat: number | null; pickup_lng: number | null;
  symptoms: string | null; sla_target_at: string | null;
  assigned_ambulance_id: string | null; created_at: string; source: string | null;
};
type IncEvent = {
  id: number; incident_id: string; event_type: string;
  payload: Record<string, unknown> | null; actor_id: string | null; at: string;
};

const SEV_LABEL: Record<string, string> = { code_red: "CODE RED", code_yellow: "CODE YELLOW", routine: "ROUTINE" };
const SEV_COLOR: Record<string, string> = {
  code_red: "text-emergency border-emergency/60 bg-emergency/10",
  code_yellow: "text-caution border-caution/60 bg-caution/10",
  routine: "text-action border-action/60 bg-action/10",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "text-emergency", assigned: "text-action",
  en_route: "text-action", on_scene: "text-caution",
  transporting: "text-caution", at_hospital: "text-action",
  completed: "text-muted-foreground", cancelled: "text-muted-foreground",
};
const STATUSES = ["pending", "assigned", "en_route", "on_scene", "transporting", "at_hospital", "completed", "cancelled"] as const;
const SEVS = ["code_red", "code_yellow", "routine"] as const;

function CallCenter() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [events, setEvents] = useState<IncEvent[]>([]);
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(["pending", "assigned", "en_route", "on_scene", "transporting", "at_hospital"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<Incident | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 5000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    const [a, i, e] = await Promise.all([
      supabase.from("ambulances").select("id,code,type,status,current_lat,current_lng,home_base").order("code"),
      supabase.from("incidents").select("id,code,severity,status,caller_name,caller_phone,patient_name,address,pickup_lat,pickup_lng,symptoms,sla_target_at,assigned_ambulance_id,created_at,source").order("created_at", { ascending: false }).limit(200),
      supabase.from("incident_events").select("id,incident_id,event_type,payload,actor_id,at").order("at", { ascending: false }).limit(500),
    ]);
    if (a.data) setAmbulances(a.data as Ambulance[]);
    if (i.data) setIncidents(i.data as Incident[]);
    if (e.data) setEvents(e.data as IncEvent[]);
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("call-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_events" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ambulances" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const ambById = useMemo(() => new Map(ambulances.map((a) => [a.id, a])), [ambulances]);

  const filteredIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      if (sevFilter.size && !sevFilter.has(i.severity)) return false;
      if (statusFilter.size && !statusFilter.has(i.status)) return false;
      if (!q) return true;
      const amb = i.assigned_ambulance_id ? ambById.get(i.assigned_ambulance_id) : null;
      return [i.code, i.address, i.caller_name, i.caller_phone, i.patient_name, i.symptoms, amb?.code]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [incidents, search, sevFilter, statusFilter, ambById]);

  const kpis = useMemo(() => {
    const open = incidents.filter((i) => !["completed", "cancelled"].includes(i.status));
    const breaching = open.filter((i) => i.sla_target_at && new Date(i.sla_target_at).getTime() < Date.now()).length;
    const pending = open.filter((i) => i.status === "pending").length;
    return { open: open.length, pending, breaching, total24: incidents.length };
  }, [incidents, tick]);

  const selected = selectedId ? incidents.find((i) => i.id === selectedId) ?? null : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_420px] h-[calc(100vh-3.5rem)] min-h-0">
      {/* FILTER RAIL */}
      <aside className="border-r border-hairline bg-panel/50 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-hairline">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Call Center</div>
          <div className="text-sm font-semibold">Operations Queue</div>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <KpiRow label="Open" value={kpis.open} accent="text-action" />
          <KpiRow label="Pending Assign" value={kpis.pending} accent="text-emergency" />
          <KpiRow label="SLA Breach" value={kpis.breaching} accent={kpis.breaching ? "text-emergency" : "text-stable"} />
          <KpiRow label="Total (recent)" value={kpis.total24} />

          <FacetGroup title="Severity" items={SEVS as readonly string[]} labels={SEV_LABEL} active={sevFilter} onToggle={(v) => setSevFilter(toggle(sevFilter, v))} />
          <FacetGroup title="Status" items={STATUSES as readonly string[]} active={statusFilter} onToggle={(v) => setStatusFilter(toggle(statusFilter, v))} />
        </div>
      </aside>

      {/* INCIDENT TABLE */}
      <section className="flex flex-col min-h-0 border-r border-hairline">
        <div className="px-4 py-3 border-b border-hairline flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, address, caller, patient, symptoms, unit…"
              className="w-full h-9 pl-9 pr-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm"
            />
          </div>
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:block">
            {filteredIncidents.length} / {incidents.length}
          </div>
          <Radio className="size-4 text-action animate-pulse" />
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 bg-panel z-10 mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <Th>Code</Th><Th>Sev</Th><Th>Status</Th><Th>Address</Th>
                <Th>Unit</Th><Th>SLA</Th><Th>Age</Th><Th className="text-right pr-4">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center mono text-[11px] uppercase tracking-widest text-muted-foreground">No incidents match filters</td></tr>
              )}
              {filteredIncidents.map((i) => {
                const amb = i.assigned_ambulance_id ? ambById.get(i.assigned_ambulance_id) : null;
                const closed = i.status === "completed" || i.status === "cancelled";
                const sla = i.sla_target_at ? new Date(i.sla_target_at).getTime() - Date.now() : null;
                const slaBreached = sla !== null && sla < 0;
                const isSel = selectedId === i.id;
                return (
                  <tr
                    key={i.id}
                    onClick={() => setSelectedId(i.id)}
                    className={`border-b border-hairline cursor-pointer hover:bg-panel-elevated/60 ${isSel ? "bg-panel-elevated" : ""} ${closed ? "opacity-60" : ""}`}
                  >
                    <Td><span className="mono text-[11px]">{i.code}</span></Td>
                    <Td><span className={`px-1.5 py-0.5 rounded border mono text-[9px] tracking-[0.15em] ${SEV_COLOR[i.severity] ?? ""}`}>{SEV_LABEL[i.severity]}</span></Td>
                    <Td><span className={`mono text-[10px] uppercase tracking-widest ${STATUS_COLOR[i.status] ?? "text-muted-foreground"}`}>{i.status.replace(/_/g, " ")}</span></Td>
                    <Td><div className="truncate max-w-[240px]">{i.address ?? <span className="text-muted-foreground">—</span>}</div></Td>
                    <Td>{amb ? <span className="mono text-[11px] text-action">{amb.code}</span> : <span className="mono text-[10px] text-muted-foreground">unassigned</span>}</Td>
                    <Td>
                      {sla === null ? <span className="text-muted-foreground">—</span> : (
                        <span className={`mono text-[10px] ${slaBreached ? "text-emergency" : "text-stable"}`}>
                          {slaBreached ? "−" : ""}{Math.abs(Math.round(sla / 60000))}m
                        </span>
                      )}
                    </Td>
                    <Td><span className="mono text-[10px] text-muted-foreground">{formatElapsed(i.created_at)}</span></Td>
                    <Td className="text-right pr-4">
                      <div className="inline-flex gap-1.5">
                        {!closed && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAssignFor(i); }}
                            className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-action text-action-foreground font-bold hover:bg-action/90 inline-flex items-center gap-1"
                          >
                            {i.assigned_ambulance_id ? <><ArrowRightLeft className="size-3" /> Reassign</> : "Assign"}
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* TIMELINE PANE */}
      <aside className="bg-panel/50 flex flex-col min-h-0">
        <TimelinePane
          selected={selected}
          events={events}
          ambById={ambById}
          onClear={() => setSelectedId(null)}
        />
      </aside>

      {assignFor && (
        <AssignDrawer
          incident={assignFor}
          ambulances={ambulances}
          currentAssigned={assignFor.assigned_ambulance_id ? ambById.get(assignFor.assigned_ambulance_id) ?? null : null}
          onClose={() => setAssignFor(null)}
          onAssigned={refresh}
        />
      )}
    </div>
  );
}

function toggle(set: Set<string>, v: string) {
  const n = new Set(set);
  if (n.has(v)) n.delete(v); else n.add(v);
  return n;
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left font-normal px-3 py-2 border-b border-hairline ${className ?? ""}`}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>;
}

function KpiRow({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className={`mono text-lg font-bold ${accent ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

function FacetGroup({ title, items, labels, active, onToggle }: {
  title: string; items: readonly string[]; labels?: Record<string, string>;
  active: Set<string>; onToggle: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
        <Filter className="size-3" /> {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => {
          const on = active.has(v);
          return (
            <button
              key={v}
              onClick={() => onToggle(v)}
              className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border transition-colors ${on ? "border-action text-action bg-action/10" : "border-hairline text-muted-foreground hover:text-foreground"}`}
            >
              {(labels?.[v] ?? v.replace(/_/g, " "))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimelinePane({ selected, events, ambById, onClear }: {
  selected: Incident | null;
  events: IncEvent[];
  ambById: Map<string, Ambulance>;
  onClear: () => void;
}) {
  const [eventSearch, setEventSearch] = useState("");
  const scoped = useMemo(() => {
    const list = selected ? events.filter((e) => e.incident_id === selected.id) : events;
    const q = eventSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) =>
      e.event_type.toLowerCase().includes(q) ||
      (e.payload && JSON.stringify(e.payload).toLowerCase().includes(q))
    );
  }, [events, selected, eventSearch]);

  return (
    <>
      <div className="px-4 py-3 border-b border-hairline">
        <div className="flex items-center justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Timeline</div>
            <div className="text-sm font-semibold flex items-center gap-2">
              {selected ? <>Incident {selected.code}</> : <>All incidents</>}
              {selected && (
                <button onClick={onClear} className="size-5 grid place-items-center rounded hover:bg-panel-elevated text-muted-foreground"><X className="size-3" /></button>
              )}
            </div>
          </div>
          <Clock className="size-4 text-muted-foreground" />
        </div>
        {selected && (
          <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
            <div className="truncate">{selected.address ?? "—"}</div>
            <div className="mono uppercase tracking-widest text-[10px]">
              <span className={STATUS_COLOR[selected.status] ?? ""}>{selected.status.replace(/_/g, " ")}</span>
              {selected.assigned_ambulance_id && (
                <span className="text-action"> · {ambById.get(selected.assigned_ambulance_id)?.code ?? "—"}</span>
              )}
              {selected.source && <span> · src:{selected.source}</span>}
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-2 border-b border-hairline">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Search events…"
            className="w-full h-8 pl-8 pr-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {scoped.length === 0 && (
          <div className="p-6 text-center mono text-[11px] uppercase tracking-widest text-muted-foreground">No events</div>
        )}
        <ol className="relative">
          {scoped.map((e) => (
            <li key={e.id} className="px-4 py-2.5 border-b border-hairline/60 hover:bg-panel-elevated/40">
              <div className="flex items-center justify-between gap-3">
                <span className="mono text-[10px] uppercase tracking-[0.16em] text-action">{e.event_type}</span>
                <span className="mono text-[10px] text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
              </div>
              {!selected && (
                <div className="mono text-[10px] text-muted-foreground mt-0.5">incident: {e.incident_id.slice(0, 8)}</div>
              )}
              {e.payload && Object.keys(e.payload).length > 0 && (
                <pre className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap break-words leading-snug max-h-32 overflow-auto">
                  {JSON.stringify(e.payload, null, 0)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

function AssignDrawer({ incident, ambulances, currentAssigned, onClose, onAssigned }: {
  incident: Incident;
  ambulances: Ambulance[];
  currentAssigned: Ambulance | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [reason, setReason] = useState("");
  const ranked = useMemo(() => {
    return ambulances
      .filter((a) => a.id !== currentAssigned?.id)
      .filter((a) => a.status === "available" || (currentAssigned && a.status === "out_of_service" === false))
      .filter((a) => a.status === "available")
      .map((a) => {
        const km = (incident.pickup_lat != null && incident.pickup_lng != null && a.current_lat != null && a.current_lng != null)
          ? haversineKm({ lat: incident.pickup_lat, lng: incident.pickup_lng }, { lat: a.current_lat, lng: a.current_lng })
          : null;
        return { a, km };
      })
      .sort((x, y) => (x.km ?? 9999) - (y.km ?? 9999));
  }, [ambulances, incident, currentAssigned]);

  async function assign(amb: Ambulance) {
    const isReassign = !!currentAssigned;
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

    const upd = await supabase.from("incidents")
      .update({ assigned_ambulance_id: amb.id, status: "assigned" })
      .eq("id", incident.id);
    if (upd.error) return toast.error(upd.error.message);

    if (currentAssigned) {
      await supabase.from("ambulances").update({ status: "available" }).eq("id", currentAssigned.id);
    }
    await supabase.from("ambulances").update({ status: "en_route" }).eq("id", amb.id);

    await supabase.from("incident_events").insert({
      incident_id: incident.id,
      event_type: isReassign ? "reassigned" : "assigned",
      actor_id: userId,
      payload: {
        to_ambulance: amb.code,
        to_ambulance_id: amb.id,
        ...(currentAssigned ? { from_ambulance: currentAssigned.code, from_ambulance_id: currentAssigned.id } : {}),
        ...(reason ? { reason } : {}),
      },
    });

    toast.success(isReassign ? `Reassigned → ${amb.code}` : `${amb.code} dispatched`);
    onAssigned();
    onClose();
  }

  async function unassign() {
    if (!currentAssigned) return;
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const upd = await supabase.from("incidents")
      .update({ assigned_ambulance_id: null, status: "pending" })
      .eq("id", incident.id);
    if (upd.error) return toast.error(upd.error.message);
    await supabase.from("ambulances").update({ status: "available" }).eq("id", currentAssigned.id);
    await supabase.from("incident_events").insert({
      incident_id: incident.id,
      event_type: "unassigned",
      actor_id: userId,
      payload: { from_ambulance: currentAssigned.code, from_ambulance_id: currentAssigned.id, ...(reason ? { reason } : {}) },
    });
    toast.success(`Released ${currentAssigned.code}`);
    onAssigned();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-panel border-l border-hairline overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-panel border-b border-hairline p-4 flex items-center justify-between">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">
              {currentAssigned ? "Reassign Unit" : "Assign Unit"}
            </div>
            <h3 className="text-lg font-bold">{incident.code}</h3>
            {currentAssigned && (
              <div className="mono text-[10px] text-muted-foreground mt-1">
                currently → <span className="text-action">{currentAssigned.code}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="size-8 grid place-items-center rounded hover:bg-panel-elevated"><X className="size-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {currentAssigned && (
            <div>
              <label className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground block mb-1.5">Reason (optional, logged)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="closer unit, mechanical, escalation…"
                className="w-full h-9 px-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm"
              />
              <button
                onClick={unassign}
                className="mt-2 w-full h-9 rounded-md border border-emergency/50 text-emergency mono text-[10px] uppercase tracking-widest font-bold hover:bg-emergency/10"
              >
                Release Unit (back to pending)
              </button>
            </div>
          )}
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-2">Available Units</div>
          {ranked.length === 0 && (
            <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground py-4">No available units</div>
          )}
          {ranked.map(({ a, km }) => (
            <button key={a.id} onClick={() => assign(a)} className="w-full text-left px-3 py-3 rounded-md border border-hairline bg-panel-elevated/40 hover:bg-panel-elevated transition-colors">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{a.code} <span className="mono text-[10px] text-muted-foreground ml-1">{a.type}</span></div>
                <div className="mono text-[10px] text-action">
                  {km !== null ? <>{km.toFixed(1)} km · ~{etaMinutes(km)}m</> : "no GPS"}
                </div>
              </div>
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{a.home_base ?? "—"}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}