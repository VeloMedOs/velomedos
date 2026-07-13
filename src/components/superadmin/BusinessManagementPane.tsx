import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminFetch } from "@/lib/admin-fetch";
import { Building2, ClipboardList, Server, RefreshCw, Search } from "lucide-react";
import { PipelineBoard } from "@/components/superadmin/PipelineBoard";

type Tab = "intake" | "all" | "provisioning";

type Tenant = {
  id: string; company_name: string; slug: string | null;
  tenant_type: "sandbox" | "partner" | "production";
  tenant_lifecycle: "intake" | "provisioning" | "active" | "suspended" | "archived";
  country: string | null; created_at: string;
};

type Prov = {
  id: string; admin_email: string; requested_slug: string;
  target_tenant_type: string; status: string;
  created_at: string; completed_at: string | null; notes: string | null;
};

const TYPE_TONE: Record<Tenant["tenant_type"], string> = {
  sandbox: "bg-caution/20 text-caution",
  partner: "bg-teal/20 text-teal",
  production: "bg-stable/20 text-stable",
};
const LIFECYCLE_TONE: Record<Tenant["tenant_lifecycle"], string> = {
  intake: "bg-muted text-muted-foreground",
  provisioning: "bg-sky/20 text-sky",
  active: "bg-stable/20 text-stable",
  suspended: "bg-coral/20 text-coral",
  archived: "bg-muted text-muted-foreground",
};

export function BusinessManagementPane() {
  const [tab, setTab] = useState<Tab>("intake");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 border-b border-hairline">
        <TabBtn active={tab === "intake"} onClick={() => setTab("intake")} icon={ClipboardList} label="Intake queue" />
        <TabBtn active={tab === "all"} onClick={() => setTab("all")} icon={Building2} label="All businesses" />
        <TabBtn active={tab === "provisioning"} onClick={() => setTab("provisioning")} icon={Server} label="Provisioning queue" />
      </div>
      {tab === "intake" && <PipelineBoard />}
      {tab === "all" && <AllBusinessesTab />}
      {tab === "provisioning" && <ProvisioningTab />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }:
  { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 mono text-[10px] uppercase tracking-widest border-b-2 -mb-px ${
        active ? "border-teal text-teal" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function AllBusinessesTab() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const j = await adminFetch<{ tenants: Tenant[] }>("/api/admin/v1/superadmin/tenants");
      setTenants(j.tenants);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tenants;
    return tenants.filter((t) =>
      (t.company_name ?? "").toLowerCase().includes(s) ||
      (t.slug ?? "").toLowerCase().includes(s));
  }, [tenants, q]);

  async function act(id: string, path: string, label: string) {
    try {
      await adminFetch(`/api/admin/v1/superadmin/tenants/${id}/${path}`, { method: "POST", body: {} });
      toast.success(label);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or slug…"
                 className="w-full h-9 pl-8 pr-3 rounded bg-input border border-hairline text-sm" />
        </div>
        <button onClick={load} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline inline-flex items-center gap-1">
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> reload
        </button>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{filtered.length} tenants</div>
      </div>
      <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
              <th className="py-2 px-3">Company</th><th>Slug</th><th>Type</th><th>Lifecycle</th>
              <th>Country</th><th>Created</th><th className="text-right pr-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {filtered.length === 0 && <tr><td colSpan={7} className="py-6 px-3 text-xs text-muted-foreground">No tenants.</td></tr>}
            {filtered.map((t) => (
              <tr key={t.id}>
                <td className="py-2 px-3 font-medium">{t.company_name}</td>
                <td className="py-2 px-3 mono text-[11px] text-muted-foreground">{t.slug ?? "—"}</td>
                <td className="py-2 px-3"><span className={`mono text-[10px] px-2 py-0.5 rounded ${TYPE_TONE[t.tenant_type]}`}>{t.tenant_type}</span></td>
                <td className="py-2 px-3"><span className={`mono text-[10px] px-2 py-0.5 rounded ${LIFECYCLE_TONE[t.tenant_lifecycle]}`}>{t.tenant_lifecycle}</span></td>
                <td className="py-2 px-3 mono text-[10px]">{t.country ?? "—"}</td>
                <td className="py-2 px-3 mono text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="py-2 px-3 text-right space-x-1">
                  {t.tenant_lifecycle === "active" && (
                    <button onClick={() => act(t.id, "suspend", "Suspended")}
                            className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated">suspend</button>
                  )}
                  {t.tenant_lifecycle === "suspended" && (
                    <button onClick={() => act(t.id, "reactivate", "Reactivated")}
                            className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated">reactivate</button>
                  )}
                  {t.tenant_type !== "production" && (
                    <button onClick={() => act(t.id, "promote", "Promoted")}
                            className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-teal/40 text-teal hover:bg-teal/10">promote</button>
                  )}
                  {t.tenant_lifecycle !== "archived" && (
                    <button onClick={() => act(t.id, "archive", "Archived")}
                            className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-coral/40 text-coral hover:bg-coral/10">archive</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProvisioningTab() {
  const [rows, setRows] = useState<Prov[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const j = await adminFetch<{ requests: Prov[] }>("/api/admin/v1/superadmin/provisioning");
      setRows(j.requests);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    try {
      await adminFetch(`/api/admin/v1/superadmin/provisioning/${id}/approve`, { method: "POST", body: {} });
      toast.success("Approved"); load();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function reject(id: string) {
    const reason = prompt("Reason for rejection?") ?? "";
    try {
      await adminFetch(`/api/admin/v1/superadmin/provisioning/${id}/reject`, { method: "POST", body: { reason } });
      toast.success("Rejected"); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{rows.length} requests</div>
        <button onClick={load} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline inline-flex items-center gap-1">
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> reload
        </button>
      </div>
      <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
              <th className="py-2 px-3">Admin email</th><th>Slug</th><th>Type</th><th>Status</th>
              <th>Created</th><th className="text-right pr-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 px-3 text-xs text-muted-foreground">No provisioning requests.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 px-3 mono text-[11px]">{r.admin_email}</td>
                <td className="py-2 px-3 mono text-[11px] text-muted-foreground">{r.requested_slug}</td>
                <td className="py-2 px-3 mono text-[10px]">{r.target_tenant_type}</td>
                <td className="py-2 px-3 mono text-[10px]">{r.status}</td>
                <td className="py-2 px-3 mono text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="py-2 px-3 text-right space-x-1">
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => approve(r.id)} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-stable/40 text-stable hover:bg-stable/10">approve</button>
                      <button onClick={() => reject(r.id)}  className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-coral/40 text-coral hover:bg-coral/10">reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}