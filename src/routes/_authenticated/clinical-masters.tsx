import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Database, Plus, Trash2, ArrowLeft, Receipt, Coins, ShieldAlert } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { useClinicalMe, canAct } from "@/lib/clinical-roles";

export const Route = createFileRoute("/_authenticated/clinical-masters")({
  head: () => ({ meta: [{ title: "Clinical Masters · VeloMed OS" }] }),
  component: ClinicalMastersPage,
});

type MasterDef = {
  id: string;
  label: string;
  resource: string;
  columns: { key: string; label: string }[];
  fields: { key: string; label: string; type?: "text" | "number" | "select"; options?: string[]; required?: boolean }[];
  hint?: string;
};

const GROUPS: { id: string; label: string; defs: MasterDef[] }[] = [
  {
    id: "insurance", label: "Insurance Chain",
    defs: [
      { id: "payers", resource: "payers", label: "Payers",
        columns: [{ key: "name", label: "Name" }, { key: "license_no", label: "License" }, { key: "country", label: "Country" }],
        fields: [
          { key: "name", label: "Name", required: true },
          { key: "license_no", label: "License #" },
          { key: "country", label: "Country" },
        ],
      },
      { id: "tpas", resource: "tpas", label: "TPAs",
        columns: [{ key: "name", label: "Name" }, { key: "license_no", label: "License" }],
        fields: [{ key: "name", label: "Name", required: true }, { key: "license_no", label: "License #" }],
      },
      { id: "networks", resource: "networks", label: "Networks",
        columns: [{ key: "name", label: "Name" }, { key: "payer_id", label: "Payer" }],
        fields: [{ key: "name", label: "Name", required: true }, { key: "payer_id", label: "Payer ID", required: true }],
      },
      { id: "insurance-plans", resource: "insurance-plans", label: "Insurance Plans",
        columns: [{ key: "name", label: "Name" }, { key: "copay_percent", label: "Copay %" }, { key: "deductible_minor", label: "Deductible (halalas)" }],
        fields: [
          { key: "name", label: "Name", required: true },
          { key: "payer_id", label: "Payer ID", required: true },
          { key: "copay_percent", label: "Copay %", type: "number" },
          { key: "deductible_minor", label: "Deductible (halalas)", type: "number" },
        ],
      },
    ],
  },
  {
    id: "catalog", label: "Service Catalog",
    defs: [
      { id: "services", resource: "services", label: "Service Master",
        columns: [{ key: "name", label: "Name" }, { key: "category", label: "Category" }],
        fields: [
          { key: "name", label: "Name", required: true },
          { key: "category", label: "Category (lab|rad|procedure|consult|pharmacy)", required: true },
        ],
        hint: "Codes (SBS/ACHI/LOINC) are managed via the per-service codes endpoint.",
      },
      { id: "drugs", resource: "drugs", label: "Drug Master",
        columns: [{ key: "brand_name", label: "Brand" }, { key: "generic_name", label: "Generic" }, { key: "sfda_code", label: "SFDA" }],
        fields: [
          { key: "brand_name", label: "Brand name", required: true },
          { key: "generic_name", label: "Generic name" },
          { key: "sfda_code", label: "SFDA code" },
          { key: "gtin", label: "GTIN" },
        ],
      },
    ],
  },
  {
    id: "pricing", label: "Pricing",
    defs: [
      { id: "price-lists", resource: "price-lists", label: "Price Lists",
        columns: [{ key: "name", label: "Name" }, { key: "currency", label: "Currency" }, { key: "kind", label: "Kind" }],
        fields: [
          { key: "name", label: "Name", required: true },
          { key: "kind", label: "Kind (contract|cost|cash)", required: true },
          { key: "currency", label: "Currency", required: true },
        ],
      },
      { id: "pricing-rules", resource: "pricing-rules", label: "Pricing Rules (tenant overrides)",
        columns: [{ key: "name", label: "Name" }, { key: "rule_type", label: "Type" }, { key: "priority", label: "Priority" }],
        fields: [
          { key: "name", label: "Name", required: true },
          { key: "rule_type", label: "Type", required: true },
          { key: "priority", label: "Priority", type: "number" },
        ],
      },
    ],
  },
  {
    id: "drg", label: "DRG (Contractual)",
    defs: [
      { id: "drg-base-rates", resource: "drg-base-rates", label: "DRG Base Rates",
        columns: [{ key: "drg_version", label: "Version" }, { key: "base_rate_minor", label: "Base rate (halalas)" }, { key: "currency", label: "Cur" }, { key: "effective_from", label: "From" }],
        fields: [
          { key: "payer_id", label: "Payer ID", required: true },
          { key: "drg_version", label: "DRG version (e.g. AR-DRG-v9.0)", required: true },
          { key: "base_rate_minor", label: "Base rate (halalas)", type: "number", required: true },
          { key: "currency", label: "Currency", required: true },
          { key: "effective_from", label: "Effective from (YYYY-MM-DD)", required: true },
        ],
        hint: "DRG catalog (codes + weights) is managed in the superadmin reference library.",
      },
      { id: "drg-adjustments", resource: "drg-adjustments", label: "DRG Price Adjustments",
        columns: [{ key: "adj_type", label: "Type" }, { key: "drg_version", label: "Version" }, { key: "priority", label: "Pri" }, { key: "active", label: "On" }],
        fields: [
          { key: "payer_id", label: "Payer ID", required: true },
          { key: "drg_version", label: "DRG version", required: true },
          { key: "adj_type", label: "Adj type (high_outlier|low_outlier|icu_addon|same_day|short_stay_per_diem)", required: true },
          { key: "trim_basis", label: "Trim basis (los)" },
          { key: "threshold", label: "Threshold", type: "number" },
          { key: "marginal_rate", label: "Marginal rate (0.0–1.0)", type: "number" },
          { key: "per_diem_minor", label: "Per-diem (halalas)", type: "number" },
          { key: "priority", label: "Priority", type: "number" },
        ],
      },
    ],
  },
];

function ClinicalMastersPage() {
  const { me, loading } = useClinicalMe();
  const [groupId, setGroupId] = useState(GROUPS[0].id);
  const [defId, setDefId] = useState(GROUPS[0].defs[0].id);
  const group = GROUPS.find((g) => g.id === groupId)!;
  const def = group.defs.find((d) => d.id === defId) ?? group.defs[0];

  if (loading) return <div className="p-10 mono text-xs text-muted-foreground">Loading…</div>;
  if (!me || !canAct(me, [])) {
    return (
      <div className="max-w-2xl mx-auto p-10">
        <div className="rounded-xl border border-emergency/40 bg-emergency/5 p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="size-4 text-emergency" />
            <div className="mono text-[10px] uppercase tracking-widest text-emergency">tenant_admin required</div>
          </div>
          <p className="text-sm text-muted-foreground">Clinical masters are tenant_admin only. Contractual edits go through this surface; reference catalog (DRG codes/weights) lives in the superadmin portal.</p>
          <Link to="/admin" className="inline-block mt-4 text-xs text-action underline">Back to Admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <Link to="/admin" className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2">
            <ArrowLeft className="size-3" /> Admin
          </Link>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal flex items-center gap-2">
            <Database className="size-3" /> Clinical Masters
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Insurance · Catalog · Pricing · DRG</h1>
        </div>
      </header>

      <div className="flex gap-1 border-b border-hairline overflow-x-auto">
        {GROUPS.map((g) => (
          <button key={g.id}
            onClick={() => { setGroupId(g.id); setDefId(g.defs[0].id); }}
            className={`px-4 py-2 mono text-[11px] uppercase tracking-widest border-b-2 -mb-px ${groupId === g.id ? "border-action text-action" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {group.defs.map((d) => (
          <button key={d.id} onClick={() => setDefId(d.id)}
            className={`px-3 py-1.5 rounded mono text-[10px] uppercase tracking-widest border ${defId === d.id ? "border-action bg-action/10 text-action" : "border-hairline text-muted-foreground hover:text-foreground"}`}>
            {d.label}
          </button>
        ))}
      </div>

      <MasterTable key={def.id} def={def} />
    </div>
  );
}

function MasterTable({ def }: { def: MasterDef }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  async function refresh() {
    setLoading(true);
    try {
      const r = await ClinicalAPI.listMaster(def.resource);
      setRows(r.data);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [def.id]);

  async function create() {
    const payload: Record<string, unknown> = {};
    for (const f of def.fields) {
      const v = form[f.key];
      if (f.required && (v === undefined || v === "")) return toast.error(`${f.label} required`);
      if (v === undefined || v === "") continue;
      payload[f.key] = f.type === "number" ? Number(v) : v;
    }
    try {
      await ClinicalAPI.createMaster(def.resource, payload);
      toast.success("Created");
      setCreating(false);
      setForm({});
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this row?")) return;
    try { await ClinicalAPI.deleteMaster(def.resource, id); toast.success("Deleted"); refresh(); }
    catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }

  return (
    <div className="rounded-xl border border-hairline bg-panel">
      <div className="px-4 py-2.5 border-b border-hairline mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
        <span>{def.label} {def.hint ? <span className="normal-case tracking-normal text-muted-foreground/70 ml-2">· {def.hint}</span> : null}</span>
        <button onClick={() => setCreating(true)} className="px-3 py-1 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground flex items-center gap-1">
          <Plus className="size-3" /> New
        </button>
      </div>

      {creating && (
        <div className="p-4 border-b border-hairline bg-action/5">
          <div className="grid md:grid-cols-2 gap-3">
            {def.fields.map((f) => (
              <label key={f.key} className="block">
                <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{f.label}{f.required && <span className="text-emergency"> *</span>}</div>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full h-9 px-2 bg-input border border-hairline rounded text-sm"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={create} className="px-3 h-8 rounded mono text-[10px] uppercase tracking-widest bg-stable text-stable-foreground">Save</button>
            <button onClick={() => { setCreating(false); setForm({}); }} className="px-3 h-8 rounded mono text-[10px] uppercase tracking-widest border border-hairline">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
              {def.columns.map((c) => <th key={c.key} className="py-2 px-3">{c.label}</th>)}
              <th className="py-2 px-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {loading && <tr><td colSpan={def.columns.length + 1} className="py-4 px-3 text-xs text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={def.columns.length + 1} className="py-4 px-3 text-xs text-muted-foreground">No rows yet.</td></tr>}
            {rows.map((row) => (
              <tr key={row.id}>
                {def.columns.map((c) => (
                  <td key={c.key} className="py-2 px-3 text-sm">
                    <span className="mono text-[11px]">{formatCell(row[c.key])}</span>
                  </td>
                ))}
                <td className="py-2 px-3 text-right">
                  <button onClick={() => remove(row.id)} className="text-emergency hover:bg-emergency/10 p-1 rounded"><Trash2 className="size-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}