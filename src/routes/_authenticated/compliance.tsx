import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Wrench, AlertOctagon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/compliance")({ component: Compliance });

type Credential = {
  id: string;
  kind: "paramedic_license" | "driver_license" | "vehicle_registration" | "operating_permit" | "provider_license";
  subject_user_id: string | null;
  subject_ambulance_id: string | null;
  reference: string;
  issuer: string | null;
  expires_on: string;
};
type Defect = { id: string; vehicle_id: string; severity: "minor" | "major" | "critical"; blocks_service: boolean; description: string; resolved_at: string | null; created_at: string };
type WorkOrder = { id: string; vehicle_id: string; type: "preventive" | "corrective"; status: "open" | "in_progress" | "closed" | "cancelled"; opened_at: string; closed_at: string | null };
type Ambulance = { id: string; code: string };

function daysUntil(d: string): number {
  return Math.floor((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function Compliance() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [wos, setWos] = useState<WorkOrder[]>([]);
  const [fleet, setFleet] = useState<Ambulance[]>([]);
  const [newCred, setNewCred] = useState({ kind: "vehicle_registration" as Credential["kind"], subject_ambulance_id: "", reference: "", issuer: "", expires_on: "" });
  const [newDefect, setNewDefect] = useState({ vehicle_id: "", severity: "minor" as Defect["severity"], blocks_service: false, description: "" });

  async function refresh() {
    const [c, d, w, f] = await Promise.all([
      supabase.from("credentials").select("id,kind,subject_user_id,subject_ambulance_id,reference,issuer,expires_on").order("expires_on"),
      supabase.from("defects").select("id,vehicle_id,severity,blocks_service,description,resolved_at,created_at").order("created_at", { ascending: false }),
      supabase.from("work_orders").select("id,vehicle_id,type,status,opened_at,closed_at").order("opened_at", { ascending: false }).limit(50),
      supabase.from("ambulances").select("id,code").order("code"),
    ]);
    if (c.data) setCreds(c.data as Credential[]);
    if (d.data) setDefects(d.data as Defect[]);
    if (w.data) setWos(w.data as WorkOrder[]);
    if (f.data) setFleet(f.data as Ambulance[]);
  }
  useEffect(() => { refresh(); }, []);

  const vehicleCode = useMemo(() => Object.fromEntries(fleet.map((a) => [a.id, a.code])), [fleet]);
  const expiringSoon = creds.filter((c) => daysUntil(c.expires_on) <= 30);
  const blockingDefects = defects.filter((d) => d.blocks_service && !d.resolved_at);
  const openWos = wos.filter((w) => w.status === "open" || w.status === "in_progress");

  async function addCredential() {
    if (!newCred.reference || !newCred.expires_on || !newCred.subject_ambulance_id) return toast.error("Fill reference, expiry and vehicle");
    const { error } = await supabase.from("credentials").insert({
      kind: newCred.kind,
      subject_ambulance_id: newCred.subject_ambulance_id,
      reference: newCred.reference,
      issuer: newCred.issuer || null,
      expires_on: newCred.expires_on,
    });
    if (error) return toast.error(error.message);
    toast.success("Credential filed");
    setNewCred({ kind: "vehicle_registration", subject_ambulance_id: "", reference: "", issuer: "", expires_on: "" });
    refresh();
  }

  async function addDefect() {
    if (!newDefect.vehicle_id || !newDefect.description) return toast.error("Pick vehicle and describe defect");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("defects").insert({ ...newDefect, reported_by: user.id });
    if (error) return toast.error(error.message);
    toast.success("Defect logged");
    setNewDefect({ vehicle_id: "", severity: "minor", blocks_service: false, description: "" });
    refresh();
  }

  async function resolveDefect(id: string) {
    const { error } = await supabase.from("defects").update({ resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function openWorkOrder(vehicle_id: string) {
    const { error } = await supabase.from("work_orders").insert({ vehicle_id, type: "corrective" });
    if (error) return toast.error(error.message);
    toast.success("Work order opened");
    refresh();
  }

  async function closeWorkOrder(id: string) {
    const { error } = await supabase.from("work_orders").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Compliance & fleet maintenance</div>
        <h1 className="text-2xl font-bold tracking-tight">Eligibility gate</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi icon={<ShieldAlert className="size-4" />} tone="emergency" label="Expiring ≤ 30d" value={expiringSoon.length} />
        <Kpi icon={<AlertOctagon className="size-4" />} tone="caution" label="Blocking defects" value={blockingDefects.length} />
        <Kpi icon={<Wrench className="size-4" />} tone="action" label="Open work orders" value={openWos.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-panel">
          <header className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2"><ShieldCheck className="size-3.5" /> Credentials</header>
          <div className="p-3 border-b border-hairline grid grid-cols-2 gap-2">
            <select value={newCred.kind} onChange={(e) => setNewCred({ ...newCred, kind: e.target.value as Credential["kind"] })} className="h-9 px-2 rounded bg-input border border-hairline text-sm">
              <option value="vehicle_registration">Vehicle registration</option>
              <option value="operating_permit">Operating permit</option>
              <option value="paramedic_license">Paramedic license</option>
              <option value="driver_license">Driver license</option>
              <option value="provider_license">Provider license</option>
            </select>
            <select value={newCred.subject_ambulance_id} onChange={(e) => setNewCred({ ...newCred, subject_ambulance_id: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm">
              <option value="">— vehicle —</option>
              {fleet.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}
            </select>
            <input placeholder="reference" value={newCred.reference} onChange={(e) => setNewCred({ ...newCred, reference: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm" />
            <input placeholder="issuer" value={newCred.issuer} onChange={(e) => setNewCred({ ...newCred, issuer: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm" />
            <input type="date" value={newCred.expires_on} onChange={(e) => setNewCred({ ...newCred, expires_on: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm col-span-2" />
            <button onClick={addCredential} className="col-span-2 h-9 rounded bg-action text-action-foreground mono text-[11px] uppercase tracking-widest font-bold">File credential</button>
          </div>
          <ul className="max-h-[420px] overflow-y-auto divide-y divide-hairline">
            {creds.map((c) => {
              const days = daysUntil(c.expires_on);
              const tone = days < 0 ? "text-emergency" : days <= 30 ? "text-caution" : "text-stable";
              return (
                <li key={c.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{c.reference} <span className="mono text-[10px] uppercase text-muted-foreground">· {c.kind.replace(/_/g, " ")}</span></div>
                    <div className="mono text-[11px] text-muted-foreground">{c.subject_ambulance_id ? vehicleCode[c.subject_ambulance_id] ?? "—" : "personal"}{c.issuer ? ` · ${c.issuer}` : ""}</div>
                  </div>
                  <div className={`mono text-[11px] ${tone}`}>{c.expires_on} · {days < 0 ? `${-days}d overdue` : `${days}d`}</div>
                </li>
              );
            })}
            {creds.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No credentials filed</li>}
          </ul>
        </section>

        <section className="rounded-lg border border-hairline bg-panel">
          <header className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2"><AlertOctagon className="size-3.5" /> Defects</header>
          <div className="p-3 border-b border-hairline grid grid-cols-2 gap-2">
            <select value={newDefect.vehicle_id} onChange={(e) => setNewDefect({ ...newDefect, vehicle_id: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm">
              <option value="">— vehicle —</option>
              {fleet.map((a) => <option key={a.id} value={a.id}>{a.code}</option>)}
            </select>
            <select value={newDefect.severity} onChange={(e) => setNewDefect({ ...newDefect, severity: e.target.value as Defect["severity"] })} className="h-9 px-2 rounded bg-input border border-hairline text-sm">
              <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
            </select>
            <input placeholder="description" value={newDefect.description} onChange={(e) => setNewDefect({ ...newDefect, description: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm col-span-2" />
            <label className="flex items-center gap-2 text-xs mono uppercase tracking-widest text-muted-foreground"><input type="checkbox" checked={newDefect.blocks_service} onChange={(e) => setNewDefect({ ...newDefect, blocks_service: e.target.checked })} /> Blocks service</label>
            <button onClick={addDefect} className="h-9 rounded bg-emergency text-emergency-foreground mono text-[11px] uppercase tracking-widest font-bold">Log defect</button>
          </div>
          <ul className="max-h-[420px] overflow-y-auto divide-y divide-hairline">
            {defects.map((d) => (
              <li key={d.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{vehicleCode[d.vehicle_id] ?? d.vehicle_id} · <span className="mono text-[10px] uppercase text-muted-foreground">{d.severity}{d.blocks_service ? " · blocking" : ""}</span></div>
                  <div className="text-muted-foreground text-xs">{d.description}</div>
                </div>
                {d.resolved_at ? <span className="mono text-[10px] uppercase text-stable">resolved</span> : (
                  <div className="flex gap-2">
                    <button onClick={() => openWorkOrder(d.vehicle_id)} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated">Open WO</button>
                    <button onClick={() => resolveDefect(d.id)} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-stable/20 text-stable hover:bg-stable/30">Resolve</button>
                  </div>
                )}
              </li>
            ))}
            {defects.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No defects logged</li>}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-hairline bg-panel">
        <header className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2"><Wrench className="size-3.5" /> Work orders</header>
        <ul className="divide-y divide-hairline max-h-[360px] overflow-y-auto">
          {wos.map((w) => (
            <li key={w.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{vehicleCode[w.vehicle_id] ?? w.vehicle_id} <span className="mono text-[10px] uppercase text-muted-foreground">· {w.type} · {w.status}</span></div>
                <div className="mono text-[11px] text-muted-foreground">opened {new Date(w.opened_at).toLocaleString()}{w.closed_at ? ` · closed ${new Date(w.closed_at).toLocaleString()}` : ""}</div>
              </div>
              {w.status !== "closed" && w.status !== "cancelled" && (
                <button onClick={() => closeWorkOrder(w.id)} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-action/20 text-action hover:bg-action/30">Close</button>
              )}
            </li>
          ))}
          {wos.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No work orders</li>}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "emergency" | "caution" | "action" }) {
  const color = tone === "emergency" ? "text-emergency" : tone === "caution" ? "text-caution" : "text-action";
  return (
    <div className="rounded-lg border border-hairline bg-panel p-4">
      <div className={`mono text-[10px] uppercase tracking-[0.22em] flex items-center gap-2 ${color}`}>{icon}{label}</div>
      <div className="mono text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}