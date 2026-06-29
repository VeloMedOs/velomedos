import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Globe, Shield, RefreshCw, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clinical-superadmin")({
  head: () => ({ meta: [{ title: "Cross-Tenant Clinical · VeloMed OS" }] }),
  component: ClinicalSuperadminPage,
});

type Row = {
  id: string;
  tenant_id: string;
  encounter_id: string;
  provider_claim_no: string | null;
  status: string;
  billing_model: string;
  total_net_minor: number;
  total_patient_share_minor: number;
  total_payer_share_minor: number;
  currency: string;
  created_at: string;
};

function ClinicalSuperadminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tenants, setTenants] = useState<Record<string, string>>({});
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); return; }
      const { data: roles } = await (supabase as any).from("user_roles").select("role").eq("user_id", user.id);
      setAllowed((roles ?? []).some((r: any) => r.role === "superadmin"));
    })();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      let q = (supabase as any).from("claim").select(
        "id, tenant_id, encounter_id, provider_claim_no, status, billing_model, total_net_minor, total_patient_share_minor, total_payer_share_minor, currency, created_at",
      ).order("created_at", { ascending: false }).limit(200);
      if (tenantFilter) q = q.eq("tenant_id", tenantFilter);
      if (statusFilter) q = q.eq("status", statusFilter);
      const [{ data }, { data: tn }] = await Promise.all([
        q,
        (supabase as any).from("corporate_accounts").select("id, company_name"),
      ]);
      setRows((data ?? []) as Row[]);
      setTenants(Object.fromEntries((tn ?? []).map((t: any) => [t.id, t.company_name])));
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (allowed) refresh(); /* eslint-disable-next-line */ }, [allowed, tenantFilter, statusFilter]);

  if (allowed === null) return <div className="p-10 mono text-xs text-muted-foreground">Verifying…</div>;
  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto p-10">
        <div className="rounded-xl border border-emergency/40 bg-emergency/5 p-6">
          <div className="mono text-[10px] uppercase tracking-widest text-emergency mb-1">Superadmin required</div>
          <Link to="/superadmin" className="inline-block mt-2 text-xs text-action underline">Back to Superadmin</Link>
        </div>
      </div>
    );
  }

  const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id)));

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <Link to="/superadmin" className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2">
            <ArrowLeft className="size-3" /> Superadmin
          </Link>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal flex items-center gap-2"><Globe className="size-3" /> Cross-tenant clinical</div>
          <h1 className="text-2xl font-bold tracking-tight">Claims across all tenants (read-only)</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/superadmin" search={{ tab: "apidocs" } as any} className="px-3 h-9 rounded mono text-[10px] uppercase tracking-widest border border-hairline flex items-center gap-1.5">
            <BookOpen className="size-3.5" /> Clinical API docs
          </Link>
          <button onClick={refresh} className="px-3 h-9 rounded mono text-[10px] uppercase tracking-widest border border-hairline flex items-center gap-1.5">
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
      </header>

      <section className="flex gap-2 flex-wrap">
        <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} className="h-9 px-2 bg-input border border-hairline rounded mono text-[11px]">
          <option value="">All tenants</option>
          {tenantIds.map((id) => <option key={id} value={id}>{tenants[id] ?? id.slice(0, 8)}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-2 bg-input border border-hairline rounded mono text-[11px]">
          <option value="">All statuses</option>
          <option value="draft">draft</option>
          <option value="ready">ready</option>
          <option value="submitted">submitted</option>
          <option value="adjudicated">adjudicated</option>
          <option value="paid">paid</option>
          <option value="rejected">rejected</option>
        </select>
      </section>

      <section className="rounded-xl border border-hairline bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
              <th className="py-2 px-3">Tenant</th><th>Claim</th><th>Model</th><th>Status</th>
              <th>Patient</th><th>Payer</th><th>Total</th><th>Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {loading && <tr><td colSpan={8} className="py-6 px-3 text-xs text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="py-6 px-3 text-xs text-muted-foreground">No claims found.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 px-3">{tenants[r.tenant_id] ?? <span className="mono text-[10px]">{r.tenant_id.slice(0, 8)}</span>}</td>
                <td className="py-2 px-3 mono text-[11px]">{r.provider_claim_no ?? r.id.slice(0, 8)}</td>
                <td className="py-2 px-3 mono text-[10px]">{r.billing_model}</td>
                <td className="py-2 px-3 mono text-[10px]">{r.status}</td>
                <td className="py-2 px-3 mono text-[11px]">{(r.total_patient_share_minor / 100).toFixed(2)} {r.currency}</td>
                <td className="py-2 px-3 mono text-[11px]">{(r.total_payer_share_minor / 100).toFixed(2)} {r.currency}</td>
                <td className="py-2 px-3 mono text-[11px] font-bold">{(r.total_net_minor / 100).toFixed(2)} {r.currency}</td>
                <td className="py-2 px-3 mono text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}