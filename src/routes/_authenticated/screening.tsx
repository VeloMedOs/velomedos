import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, ClipboardList, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/_authenticated/screening")({ component: Screening });

type Corp = { id: string; company_name: string; contact_email: string | null; owner_user_id: string | null };
type Pkg = { id: string; name: string; price: number; panel_tests: string[] };
type Order = { id: string; corporate_account_id: string; candidate_name: string; package_id: string; status: "booked" | "sample_collected" | "results_ready" | "certified" | "cancelled"; appointment_at: string | null; created_at: string };

function Screening() {
  const [corps, setCorps] = useState<Corp[]>([]);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [newCorp, setNewCorp] = useState({ company_name: "", contact_email: "" });
  const [newOrder, setNewOrder] = useState({ corporate_account_id: "", candidate_name: "", package_id: "", appointment_at: "" });

  async function refresh() {
    const [c, p, o] = await Promise.all([
      supabase.from("corporate_accounts").select("id,company_name,contact_email,owner_user_id").order("company_name"),
      supabase.from("screening_packages").select("id,name,price,panel_tests").eq("active", true).order("name"),
      supabase.from("screening_orders").select("id,corporate_account_id,candidate_name,package_id,status,appointment_at,created_at").order("created_at", { ascending: false }).limit(80),
    ]);
    if (c.data) setCorps(c.data as Corp[]);
    if (p.data) setPkgs(p.data as Pkg[]);
    if (o.data) setOrders(o.data as Order[]);
  }
  useEffect(() => { refresh(); }, []);

  const corpName = useMemo(() => Object.fromEntries(corps.map((c) => [c.id, c.company_name])), [corps]);
  const pkgName = useMemo(() => Object.fromEntries(pkgs.map((p) => [p.id, p.name])), [pkgs]);

  async function addCorp() {
    if (!newCorp.company_name) return toast.error("Company name required");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("corporate_accounts").insert({ ...newCorp, owner_user_id: user.id });
    if (error) return toast.error(error.message);
    setNewCorp({ company_name: "", contact_email: "" });
    refresh();
  }

  async function bookOrder() {
    if (!newOrder.corporate_account_id || !newOrder.candidate_name || !newOrder.package_id) return toast.error("Pick account, candidate & package");
    const { error } = await supabase.from("screening_orders").insert({
      corporate_account_id: newOrder.corporate_account_id,
      candidate_name: newOrder.candidate_name,
      package_id: newOrder.package_id,
      appointment_at: newOrder.appointment_at || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Booked");
    setNewOrder({ corporate_account_id: "", candidate_name: "", package_id: "", appointment_at: "" });
    refresh();
  }

  async function advance(o: Order) {
    const next: Record<Order["status"], Order["status"]> = { booked: "sample_collected", sample_collected: "results_ready", results_ready: "certified", certified: "certified", cancelled: "cancelled" };
    const { error } = await supabase.from("screening_orders").update({ status: next[o.status] }).eq("id", o.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Mobile screening clinics</div>
        <h1 className="text-2xl font-bold tracking-tight">Corporate fitness pipeline</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-panel">
          <header className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2"><Building2 className="size-3.5" /> Corporate accounts</header>
          <div className="p-3 border-b border-hairline grid grid-cols-2 gap-2">
            <input placeholder="Company name" value={newCorp.company_name} onChange={(e) => setNewCorp({ ...newCorp, company_name: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm" />
            <input placeholder="contact email" value={newCorp.contact_email} onChange={(e) => setNewCorp({ ...newCorp, contact_email: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm" />
            <button onClick={addCorp} className="col-span-2 h-9 rounded bg-action text-action-foreground mono text-[11px] uppercase tracking-widest font-bold">Add account</button>
          </div>
          <ul className="divide-y divide-hairline max-h-[360px] overflow-y-auto">
            {corps.map((c) => (
              <li key={c.id} className="px-4 py-2.5 text-sm">
                <div className="font-medium">{c.company_name}</div>
                <div className="mono text-[11px] text-muted-foreground">{c.contact_email ?? "—"}</div>
              </li>
            ))}
            {corps.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No corporate accounts yet</li>}
          </ul>
        </section>

        <section className="rounded-lg border border-hairline bg-panel">
          <header className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2"><Stethoscope className="size-3.5" /> Packages</header>
          <ul className="divide-y divide-hairline">
            {pkgs.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <div className="mono text-sm text-action">${p.price}</div>
                </div>
                <div className="mono text-[11px] text-muted-foreground mt-1">{p.panel_tests.join(" · ")}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-hairline bg-panel">
        <header className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2"><ClipboardList className="size-3.5" /> Screening orders</header>
        <div className="p-3 border-b border-hairline grid grid-cols-1 md:grid-cols-5 gap-2">
          <select value={newOrder.corporate_account_id} onChange={(e) => setNewOrder({ ...newOrder, corporate_account_id: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm">
            <option value="">— account —</option>
            {corps.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
          <input placeholder="candidate name" value={newOrder.candidate_name} onChange={(e) => setNewOrder({ ...newOrder, candidate_name: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm" />
          <select value={newOrder.package_id} onChange={(e) => setNewOrder({ ...newOrder, package_id: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm">
            <option value="">— package —</option>
            {pkgs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="datetime-local" value={newOrder.appointment_at} onChange={(e) => setNewOrder({ ...newOrder, appointment_at: e.target.value })} className="h-9 px-2 rounded bg-input border border-hairline text-sm" />
          <button onClick={bookOrder} className="h-9 rounded bg-action text-action-foreground mono text-[11px] uppercase tracking-widest font-bold">Book</button>
        </div>
        <ul className="divide-y divide-hairline max-h-[420px] overflow-y-auto">
          {orders.map((o) => (
            <li key={o.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{o.candidate_name} <span className="mono text-[10px] uppercase text-muted-foreground">· {pkgName[o.package_id] ?? "—"}</span></div>
                <div className="mono text-[11px] text-muted-foreground">{corpName[o.corporate_account_id] ?? "—"} · {o.appointment_at ? new Date(o.appointment_at).toLocaleString() : "no appt"}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-panel-elevated">{o.status.replace(/_/g, " ")}</span>
                {o.status !== "certified" && o.status !== "cancelled" && (
                  <button onClick={() => advance(o)} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-action/20 text-action hover:bg-action/30">Advance</button>
                )}
              </div>
            </li>
          ))}
          {orders.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No screening orders yet</li>}
        </ul>
      </section>
    </div>
  );
}