import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ambulance, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rentals")({ component: Rentals });

type Unit = { id: string; code: string; type: string; daily_rate: number | null; available_for_rent: boolean; status: string; home_base: string | null };
type Rental = { id: string; ambulance_id: string; start_at: string; end_at: string; daily_rate: number; status: string; total_amount: number | null };

function Rentals() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [mine, setMine] = useState<Rental[]>([]);
  const [pick, setPick] = useState<Unit | null>(null);

  async function refresh() {
    const { data: { user } } = await supabase.auth.getUser();
    const [u, r] = await Promise.all([
      supabase.from("ambulances").select("id,code,type,daily_rate,available_for_rent,status,home_base").eq("available_for_rent", true).order("code"),
      user ? supabase.from("rentals").select("id,ambulance_id,start_at,end_at,daily_rate,status,total_amount").eq("customer_id", user.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    if (u.data) setUnits(u.data as Unit[]);
    if (r.data) setMine(r.data as Rental[]);
  }
  useEffect(() => { refresh(); }, []);

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Fleet rental</div>
        <h1 className="text-2xl font-bold tracking-tight">Rent a unit by the day</h1>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {units.map((u) => (
          <div key={u.id} className="rounded-lg border border-hairline bg-panel p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><Ambulance className="size-4 text-action" />{u.code}</div>
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{u.type}</span>
            </div>
            <div className="text-xs text-muted-foreground">Home base · {u.home_base ?? "—"}</div>
            <div className="flex items-center justify-between pt-2 border-t border-hairline">
              <div><span className="mono text-2xl font-bold">${u.daily_rate ?? 0}</span><span className="mono text-[10px] text-muted-foreground"> /day</span></div>
              <button onClick={() => setPick(u)} className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded bg-action text-action-foreground font-bold">Book</button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">My rentals</div>
        <div className="space-y-2">
          {mine.length === 0 && <div className="text-sm text-muted-foreground">No rentals yet</div>}
          {mine.map((r) => {
            const u = units.find((x) => x.id === r.ambulance_id);
            return (
              <div key={r.id} className="rounded-lg border border-hairline bg-panel p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{u?.code ?? "Unit"} <span className="mono text-[10px] text-muted-foreground ml-2">{r.status}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(r.start_at).toLocaleDateString()} → {new Date(r.end_at).toLocaleDateString()}</div>
                </div>
                <div className="mono text-sm">${r.total_amount ?? 0}</div>
              </div>
            );
          })}
        </div>
      </div>

      {pick && <BookModal unit={pick} onClose={() => setPick(null)} onDone={refresh} />}
    </div>
  );
}

function BookModal({ unit, onClose, onDone }: { unit: Unit; onClose: () => void; onDone: () => void }) {
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const [start, setStart] = useState(today.toISOString().slice(0, 10));
  const [end, setEnd] = useState(tomorrow.toISOString().slice(0, 10));
  const days = Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
  const total = days * (unit.daily_rate ?? 0);

  async function book() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sign in first");
    const { error } = await supabase.from("rentals").insert({
      ambulance_id: unit.id, customer_id: user.id,
      start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString(),
      daily_rate: unit.daily_rate ?? 0, total_amount: total,
    });
    if (error) return toast.error(error.message);
    toast.success("Rental requested · awaiting approval");
    onDone(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={onClose}>
      <div className="w-full max-w-md bg-panel border border-hairline rounded-xl p-5 space-y-3 m-4" onClick={(e) => e.stopPropagation()}>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Rental booking</div>
        <h3 className="text-xl font-bold">{unit.code} · {unit.type}</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">From</span><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full h-10 px-3 mt-0.5 rounded bg-input border border-hairline text-sm" /></label>
          <label className="block"><span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">To</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full h-10 px-3 mt-0.5 rounded bg-input border border-hairline text-sm" /></label>
        </div>
        <div className="flex items-center justify-between border-t border-hairline pt-3">
          <div className="mono text-[11px] text-muted-foreground">{days} days × ${unit.daily_rate}</div>
          <div className="mono text-2xl font-bold">${total}</div>
        </div>
        <button onClick={book} className="w-full h-11 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold">Confirm Rental</button>
      </div>
    </div>
  );
}