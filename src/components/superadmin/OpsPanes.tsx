import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminFetch } from "@/lib/admin-fetch";
import { Trash2, Plus, RefreshCw, Save, Search } from "lucide-react";

/** Generic skinny CRUD table used by all Ops sub-panes. */
export function OpsTable<T extends { id?: string }>({
  title, endpoint, columns, fields, idKey = "id", emptyHint, transformBeforeSubmit,
}: {
  title: string;
  endpoint: string; // e.g. "/api/admin/v1/ops/refunds"
  columns: { key: string; label: string; render?: (row: T) => React.ReactNode }[];
  fields: { key: string; label: string; type?: "text" | "number" | "select" | "textarea" | "boolean"; options?: string[]; required?: boolean; placeholder?: string }[];
  idKey?: string;
  emptyHint?: string;
  transformBeforeSubmit?: (form: Record<string, unknown>) => Record<string, unknown>;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const j = await adminFetch<{ rows?: T[] }>(endpoint);
      setRows((j?.rows ?? []) as T[]);
    } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [endpoint]);

  async function create() {
    for (const f of fields) {
      if (f.required && (form[f.key] === undefined || form[f.key] === "")) {
        toast.error(`${f.label} required`); return;
      }
    }
    try {
      const payload = transformBeforeSubmit ? transformBeforeSubmit(form) : form;
      await adminFetch(endpoint, { method: "POST", body: payload });
      toast.success("Created");
      setForm({});
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this row?")) return;
    try {
      await adminFetch(`${endpoint}?id=${id}`, { method: "DELETE" });
      toast.success("Deleted"); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  const filtered = rows.filter((r) =>
    !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="text-[11px] text-muted-foreground mono">{endpoint}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="pl-7 pr-3 py-1.5 text-xs rounded-md border border-hairline bg-panel-elevated outline-none focus:border-teal" />
          </div>
          <button onClick={load} className="text-[11px] mono uppercase tracking-widest px-2.5 py-1.5 rounded-md border border-hairline hover:bg-panel-elevated flex items-center gap-1.5">
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Create form */}
      <div className="rounded-xl border border-hairline bg-panel p-4">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">New entry</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {fields.map((f) => (
            <label key={f.key} className="block text-[11px] mono uppercase tracking-widest text-muted-foreground">
              {f.label}
              {f.type === "select" ? (
                <select value={(form[f.key] as string) ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="mt-1 w-full bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs text-foreground">
                  <option value="">—</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea value={(form[f.key] as string) ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} rows={2}
                  className="mt-1 w-full bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs text-foreground" />
              ) : f.type === "boolean" ? (
                <select value={String(form[f.key] ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value === "true" })}
                  className="mt-1 w-full bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs text-foreground">
                  <option value="">—</option><option value="true">true</option><option value="false">false</option>
                </select>
              ) : (
                <input type={f.type ?? "text"} placeholder={f.placeholder} value={(form[f.key] as string | number) ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                  className="mt-1 w-full bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs text-foreground" />
              )}
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={create} className="text-[11px] mono uppercase tracking-widest px-3 py-1.5 rounded-md bg-teal text-background hover:bg-teal/90 flex items-center gap-1.5">
            <Plus className="size-3" /> Create
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="rounded-xl border border-hairline bg-panel overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
              {columns.map((c) => <th key={c.key} className="px-3 py-2">{c.label}</th>)}
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted-foreground text-[11px]">{emptyHint ?? "No rows yet"}</td></tr>
            )}
            {filtered.map((row) => {
              const id = (row as Record<string, unknown>)[idKey] as string;
              return (
                <tr key={id} className="border-b border-hairline/50 hover:bg-panel-elevated/40">
                  {columns.map((c) => (
                    <td key={c.key} className="px-3 py-2 align-top">
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(id)} className="text-muted-foreground hover:text-coral"><Trash2 className="size-3.5" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ----------------------- Per-module panes ----------------------- */

export function RefundsPane() {
  return (
    <OpsTable
      title="Refunds"
      endpoint="/api/admin/v1/ops/refunds"
      columns={[
        { key: "amount_cents", label: "Amount", render: (r: any) => `$${((r.amount_cents ?? 0) / 100).toFixed(2)} ${r.currency}` },
        { key: "status", label: "Status" },
        { key: "reason", label: "Reason" },
        { key: "external_ref", label: "Ref" },
        { key: "created_at", label: "Created", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
      fields={[
        { key: "amount_cents", label: "Amount (cents)", type: "number", required: true },
        { key: "currency", label: "Currency", placeholder: "USD" },
        { key: "reason", label: "Reason", type: "textarea" },
        { key: "status", label: "Status", type: "select", options: ["pending","succeeded","failed","cancelled"] },
        { key: "external_ref", label: "External ref" },
      ]}
    />
  );
}

export function ReviewsPane() {
  return (
    <OpsTable
      title="Trip reviews"
      endpoint="/api/admin/v1/ops/reviews"
      columns={[
        { key: "rating", label: "Rating", render: (r: any) => "★".repeat(r.rating) },
        { key: "status", label: "Status" },
        { key: "comment", label: "Comment" },
        { key: "created_at", label: "When", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
      fields={[
        { key: "rating", label: "Rating 1-5", type: "number", required: true },
        { key: "comment", label: "Comment", type: "textarea" },
        { key: "status", label: "Status", type: "select", options: ["pending","approved","hidden","flagged"] },
      ]}
    />
  );
}

export function ChatFiltersPane() {
  return (
    <OpsTable
      title="Chat content filters"
      endpoint="/api/admin/v1/ops/chat-filters"
      columns={[
        { key: "pattern", label: "Pattern" },
        { key: "kind", label: "Kind" },
        { key: "action", label: "Action" },
        { key: "is_active", label: "Active", render: (r: any) => r.is_active ? "yes" : "no" },
      ]}
      fields={[
        { key: "pattern", label: "Pattern", required: true, placeholder: "regex or word" },
        { key: "kind", label: "Kind", type: "select", options: ["profanity","pii","spam","custom"], required: true },
        { key: "action", label: "Action", type: "select", options: ["flag","redact","block"], required: true },
        { key: "is_active", label: "Active", type: "boolean" },
      ]}
    />
  );
}

export function NotificationsAdminPane() {
  return (
    <OpsTable
      title="Push & in-app notifications"
      endpoint="/api/admin/v1/ops/notifications"
      columns={[
        { key: "title", label: "Title" },
        { key: "audience", label: "Audience" },
        { key: "severity", label: "Severity" },
        { key: "created_at", label: "Sent", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
      fields={[
        { key: "title", label: "Title", required: true },
        { key: "body", label: "Body", type: "textarea" },
        { key: "severity", label: "Severity", type: "select", options: ["info","success","warning","critical"] },
        { key: "audience", label: "Audience", type: "select", options: ["all","superadmin","tenant","patient","provider","user"], required: true },
        { key: "audience_tenant_id", label: "Tenant ID (if tenant)" },
        { key: "audience_user_id", label: "User ID (if user)" },
        { key: "link_to", label: "Link" },
      ]}
    />
  );
}

export function TestRunsPane() {
  return (
    <OpsTable
      title="Test runs"
      endpoint="/api/admin/v1/ops/test-runs"
      columns={[
        { key: "suite", label: "Suite" },
        { key: "status", label: "Status" },
        { key: "passed", label: "P/F", render: (r: any) => `${r.passed}/${r.failed}` },
        { key: "duration_ms", label: "Duration", render: (r: any) => `${Math.round((r.duration_ms ?? 0)/1000)}s` },
        { key: "started_at", label: "Started", render: (r: any) => new Date(r.started_at).toLocaleString() },
      ]}
      fields={[
        { key: "suite", label: "Suite", required: true },
        { key: "branch", label: "Branch" },
        { key: "commit_sha", label: "Commit" },
        { key: "status", label: "Status", type: "select", options: ["pending","running","passed","failed","skipped"] },
        { key: "total", label: "Total", type: "number" },
        { key: "passed", label: "Passed", type: "number" },
        { key: "failed", label: "Failed", type: "number" },
        { key: "duration_ms", label: "Duration (ms)", type: "number" },
        { key: "report_url", label: "Report URL" },
      ]}
    />
  );
}

export function SmokeReportsPane() {
  return (
    <OpsTable
      title="Smoke reports"
      endpoint="/api/admin/v1/ops/smoke-reports"
      columns={[
        { key: "target", label: "Target" },
        { key: "status", label: "Status" },
        { key: "http_status", label: "HTTP" },
        { key: "latency_ms", label: "Latency", render: (r: any) => `${r.latency_ms ?? "—"} ms` },
        { key: "checked_at", label: "Checked", render: (r: any) => new Date(r.checked_at).toLocaleString() },
      ]}
      fields={[
        { key: "target", label: "Target", required: true, placeholder: "GET /api/public/v1/health" },
        { key: "status", label: "Status", type: "select", options: ["green","amber","red"], required: true },
        { key: "http_status", label: "HTTP", type: "number" },
        { key: "latency_ms", label: "Latency (ms)", type: "number" },
        { key: "message", label: "Message", type: "textarea" },
      ]}
    />
  );
}

export function ReleasesPane() {
  return (
    <OpsTable
      title="Releases"
      endpoint="/api/admin/v1/ops/releases"
      columns={[
        { key: "version", label: "Version" },
        { key: "title", label: "Title" },
        { key: "channel", label: "Channel" },
        { key: "status", label: "Status" },
        { key: "published_at", label: "Published", render: (r: any) => r.published_at ? new Date(r.published_at).toLocaleString() : "—" },
      ]}
      fields={[
        { key: "version", label: "Version", required: true, placeholder: "1.4.0" },
        { key: "title", label: "Title", required: true },
        { key: "notes", label: "Notes", type: "textarea" },
        { key: "channel", label: "Channel", type: "select", options: ["alpha","beta","stable"] },
        { key: "status", label: "Status", type: "select", options: ["draft","staged","published","rolled_back"] },
      ]}
    />
  );
}

export function AutomationsPane() {
  return (
    <OpsTable
      title="Automated events"
      endpoint="/api/admin/v1/ops/automations"
      columns={[
        { key: "name", label: "Name" },
        { key: "kind", label: "Kind" },
        { key: "schedule", label: "Schedule" },
        { key: "is_active", label: "Active", render: (r: any) => r.is_active ? "yes" : "no" },
        { key: "last_status", label: "Last status" },
      ]}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "kind", label: "Kind", type: "select", options: ["cron","webhook","manual"] },
        { key: "schedule", label: "Schedule", placeholder: "*/10 * * * *" },
        { key: "target_url", label: "Target URL" },
        { key: "is_active", label: "Active", type: "boolean" },
      ]}
    />
  );
}

export function WorkspacePane() {
  const [rows, setRows] = useState<{ key: string; value: unknown; description: string | null }[]>([]);
  const [draft, setDraft] = useState<{ key: string; value: string; description: string }>({ key: "", value: "", description: "" });

  async function load() {
    const r = await adminFetch("/api/admin/v1/ops/workspace"); const j = await r.json();
    setRows(j.rows ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save(key: string, valStr: string, description?: string) {
    let parsed: unknown = valStr;
    try { parsed = JSON.parse(valStr); } catch { /* keep string */ }
    const r = await adminFetch("/api/admin/v1/ops/workspace", { method: "PUT", body: JSON.stringify({ key, value: parsed, description }) });
    if (!r.ok) { toast.error("Save failed"); return; }
    toast.success("Saved"); load();
  }
  async function remove(key: string) {
    if (!confirm(`Delete ${key}?`)) return;
    await adminFetch(`/api/admin/v1/ops/workspace?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Workspace settings</h2>
        <div className="text-[11px] text-muted-foreground mono">/api/admin/v1/ops/workspace</div>
      </div>

      <div className="rounded-xl border border-hairline bg-panel p-4 space-y-3">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">New / update key</div>
        <div className="grid grid-cols-3 gap-3">
          <input placeholder="key (brand.name)" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} className="bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs" />
          <input placeholder='value (JSON like "Foo")' value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} className="bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs" />
          <input placeholder="description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs" />
        </div>
        <div className="text-right">
          <button onClick={() => draft.key && save(draft.key, draft.value, draft.description)} className="text-[11px] mono uppercase tracking-widest px-3 py-1.5 rounded-md bg-teal text-background hover:bg-teal/90 inline-flex items-center gap-1.5">
            <Save className="size-3" /> Save
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-panel overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
              <th className="px-3 py-2">Key</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Description</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-hairline/50">
                <td className="px-3 py-2 mono">{r.key}</td>
                <td className="px-3 py-2 mono">{JSON.stringify(r.value)}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.description ?? "—"}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => remove(r.key)} className="text-muted-foreground hover:text-coral"><Trash2 className="size-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type SecurityRow = {
  password_min_length: number; password_require_symbol: boolean; password_require_number: boolean;
  mfa_required_roles: string[]; session_ttl_minutes: number; ip_allowlist: string[]; updated_at?: string;
};

export function SecurityPane() {
  const [s, setS] = useState<SecurityRow | null>(null);
  async function load() { const r = await adminFetch("/api/admin/v1/ops/security"); setS(await r.json()); }
  useEffect(() => { load(); }, []);
  async function save() {
    if (!s) return;
    const r = await adminFetch("/api/admin/v1/ops/security", { method: "PATCH", body: JSON.stringify(s) });
    if (!r.ok) { toast.error("Save failed"); return; }
    toast.success("Saved"); load();
  }
  if (!s) return <div className="text-xs text-muted-foreground mono">Loading…</div>;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Security</h2>
        <div className="text-[11px] text-muted-foreground mono">/api/admin/v1/ops/security</div>
      </div>
      <div className="rounded-xl border border-hairline bg-panel p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
        <Num label="Password min length" v={s.password_min_length} onChange={(v) => setS({ ...s, password_min_length: v })} />
        <Num label="Session TTL (min)" v={s.session_ttl_minutes} onChange={(v) => setS({ ...s, session_ttl_minutes: v })} />
        <Bool label="Require symbol" v={s.password_require_symbol} onChange={(v) => setS({ ...s, password_require_symbol: v })} />
        <Bool label="Require number" v={s.password_require_number} onChange={(v) => setS({ ...s, password_require_number: v })} />
        <Csv label="MFA required roles" v={s.mfa_required_roles} onChange={(v) => setS({ ...s, mfa_required_roles: v })} />
        <Csv label="IP allowlist" v={s.ip_allowlist} onChange={(v) => setS({ ...s, ip_allowlist: v })} />
      </div>
      <div className="text-right">
        <button onClick={save} className="text-[11px] mono uppercase tracking-widest px-3 py-1.5 rounded-md bg-teal text-background hover:bg-teal/90 inline-flex items-center gap-1.5">
          <Save className="size-3" /> Save security settings
        </button>
      </div>
    </section>
  );
}

function Num({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <label className="block text-[11px] mono uppercase tracking-widest text-muted-foreground">
      {label}
      <input type="number" value={v} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs text-foreground" />
    </label>
  );
}
function Bool({ label, v, onChange }: { label: string; v: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="block text-[11px] mono uppercase tracking-widest text-muted-foreground">
      {label}
      <select value={String(v)} onChange={(e) => onChange(e.target.value === "true")} className="mt-1 w-full bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs text-foreground">
        <option value="true">true</option><option value="false">false</option>
      </select>
    </label>
  );
}
function Csv({ label, v, onChange }: { label: string; v: string[]; onChange: (a: string[]) => void }) {
  return (
    <label className="block text-[11px] mono uppercase tracking-widest text-muted-foreground col-span-2 md:col-span-1">
      {label}
      <input value={(v ?? []).join(", ")} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        placeholder="comma-separated" className="mt-1 w-full bg-panel-elevated border border-hairline rounded-md px-2 py-1.5 text-xs text-foreground" />
    </label>
  );
}

export function AuditLogPane() {
  const [rows, setRows] = useState<Array<{ id: string; action: string; target: string | null; actor_id: string | null; created_at: string; payload: unknown }>>([]);
  useEffect(() => { (async () => { const r = await adminFetch("/api/admin/v1/audit?limit=200"); const j = await r.json(); setRows(j.audit ?? j.rows ?? []); })(); }, []);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Audit log</h2>
      <div className="rounded-xl border border-hairline bg-panel overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
            <th className="px-3 py-2">When</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Actor</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-[11px]">No audit events</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-hairline/50">
                <td className="px-3 py-2 mono">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 mono">{r.action}</td>
                <td className="px-3 py-2 mono text-muted-foreground">{r.target ?? "—"}</td>
                <td className="px-3 py-2 mono text-muted-foreground">{r.actor_id?.slice(0,8) ?? "system"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TicketsPane() {
  return (
    <OpsTable
      title="Support tickets"
      endpoint="/api/admin/v1/tickets"
      columns={[
        { key: "subject", label: "Subject" },
        { key: "type", label: "Type" },
        { key: "priority", label: "Priority" },
        { key: "status", label: "Status" },
        { key: "created_at", label: "Created", render: (r: any) => new Date(r.created_at).toLocaleString() },
      ]}
      fields={[
        { key: "subject", label: "Subject", required: true },
        { key: "type", label: "Type", type: "select", options: ["new_business","follow_up","bug","change_request"], required: true },
        { key: "priority", label: "Priority", type: "select", options: ["low","medium","high","urgent"] },
        { key: "status", label: "Status", type: "select", options: ["open","pending","resolved","closed"] },
        { key: "body", label: "Body", type: "textarea" },
      ]}
    />
  );
}

export function BugsPane() {
  return (
    <OpsTable
      title="Bug tracker"
      endpoint="/api/admin/v1/bugs"
      idKey="id"
      columns={[
        { key: "title", label: "Title" },
        { key: "severity", label: "Severity" },
        { key: "status", label: "Status" },
        { key: "count", label: "Count" },
        { key: "last_seen_at", label: "Last seen", render: (r: any) => r.last_seen_at ? new Date(r.last_seen_at).toLocaleString() : "—" },
      ]}
      fields={[
        { key: "title", label: "Title", required: true },
        { key: "severity", label: "Severity", type: "select", options: ["low","medium","high","critical"] },
        { key: "status", label: "Status", type: "select", options: ["open","triaged","resolved","ignored"] },
        { key: "source", label: "Source", type: "select", options: ["sentry","internal","playwright"] },
        { key: "external_ref", label: "External ref" },
      ]}
    />
  );
}

export function TeamRolesShortcut() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Team &amp; roles</h2>
      <p className="text-xs text-muted-foreground">Use the <strong>Roles &amp; access</strong> tab in the nav to grant or revoke operator roles. Use the <strong>Privileges</strong> tab to fine-tune per-module access. This tab is here so the menu structure mirrors the navigation pattern in RufayQ.</p>
      <div className="rounded-xl border border-hairline bg-panel p-4 text-xs text-muted-foreground">
        Quick endpoints:
        <ul className="mt-2 space-y-1 mono">
          <li>GET /api/admin/v1/roles</li>
          <li>POST /api/admin/v1/roles {`{ user_id, role }`}</li>
          <li>PUT /api/admin/v1/privileges {`{ role, module, can_view, can_manage }`}</li>
        </ul>
      </div>
    </section>
  );
}

/* Website CMS panes are stubbed as roadmap cards since the marketing site lives outside this app. */
export function ComingSoonPane({ label, hint }: { label: string; hint: string }) {
  return (
    <section className="rounded-xl border border-hairline bg-panel p-8 text-center space-y-2">
      <div className="mono text-[10px] uppercase tracking-widest text-teal">Roadmap</div>
      <h2 className="text-lg font-semibold">{label}</h2>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">{hint}</p>
    </section>
  );
}