import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  UserPlus, Stethoscope, FileText, Hospital, Receipt,
  Lock, RefreshCw, Send, CheckCircle2,
} from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { useClinicalMe, canAct, type ClinicalRole } from "@/lib/clinical-roles";

export const Route = createFileRoute("/_authenticated/clinical")({
  head: () => ({ meta: [{ title: "Clinical Workspace · VeloMed OS" }] }),
  component: ClinicalWorkspace,
});

type TabId = "registration" | "encounters" | "coding" | "claims";

type Beneficiary = { id: string; full_name: string; document_id: string | null };
type Encounter = {
  id: string;
  class: string;
  status: string;
  journey_state: string;
  reimbursement_model: string;
  beneficiary_id: string;
  started_at: string;
};
type Claim = {
  id: string;
  encounter_id: string;
  provider_claim_no: string | null;
  status: string;
  total_net_minor: number;
  total_patient_share_minor: number;
  total_payer_share_minor: number;
  currency: string;
  billing_model: string;
  submitted_at: string | null;
};

function fmtMinor(n: number, cur = "SAR") {
  return `${(n / 100).toFixed(2)} ${cur}`;
}

function ClinicalWorkspace() {
  const { me, loading, error } = useClinicalMe();
  const [tab, setTab] = useState<TabId>("registration");

  if (loading) return <div className="p-10 mono text-xs text-muted-foreground">Loading clinical identity…</div>;
  if (error || !me) {
    return (
      <div className="max-w-2xl mx-auto p-10">
        <div className="rounded-xl border border-emergency/40 bg-emergency/5 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="size-4 text-emergency" />
            <div className="mono text-[10px] uppercase tracking-widest text-emergency">No clinical membership</div>
          </div>
          <p className="text-sm text-muted-foreground">
            {error ?? "You are not a member of a clinical tenant. Ask a tenant_admin to add you in tenant_members with a clinical_role."}
          </p>
          <Link to="/admin" className="inline-block mt-4 text-xs text-action underline">Back to Admin</Link>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: any; allowed: ClinicalRole[] }[] = [
    { id: "registration", label: "Registration", icon: UserPlus, allowed: ["registrar"] },
    { id: "encounters",   label: "Encounters",   icon: Stethoscope, allowed: ["physician", "nurse", "case_manager"] },
    { id: "coding",       label: "Coding · DRG", icon: FileText,    allowed: ["coder", "case_manager"] },
    { id: "claims",       label: "Claims",       icon: Receipt,     allowed: ["biller", "case_manager", "cashier"] },
  ];

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal flex items-center gap-2">
            <Stethoscope className="size-3" /> HIS · NPHIES MDS v3
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Clinical Workspace</h1>
          <div className="text-xs text-muted-foreground mt-1">
            Tenant <span className="mono">{me.tenantId.slice(0, 8)}…</span> · role{" "}
            <span className="mono text-action">{me.clinicalRole ?? "—"}</span>
          </div>
        </div>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
          UI gating is cosmetic — server enforces
        </div>
      </header>

      <nav className="flex gap-1 border-b border-hairline overflow-x-auto">
        {tabs.map((t) => {
          const allowed = canAct(me, t.allowed);
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              disabled={!allowed}
              className={`px-4 py-2 mono text-[11px] uppercase tracking-widest border-b-2 -mb-px flex items-center gap-2 transition ${
                tab === t.id
                  ? "border-action text-action"
                  : allowed
                    ? "border-transparent text-muted-foreground hover:text-foreground"
                    : "border-transparent text-muted-foreground/40 cursor-not-allowed"
              }`}
              title={allowed ? "" : `Requires clinical_role in ${t.allowed.join(", ")}`}
            >
              <t.icon className="size-3.5" />
              {t.label}
              {!allowed && <Lock className="size-3" />}
            </button>
          );
        })}
      </nav>

      {tab === "registration" && <RegistrationPane />}
      {tab === "encounters"   && <EncountersPane />}
      {tab === "coding"       && <CodingPane />}
      {tab === "claims"       && <ClaimsPane />}
    </div>
  );
}

/* ───────── Registration ───────── */

function RegistrationPane() {
  const [list, setList] = useState<Beneficiary[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [coverage, setCoverage] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: "", document_id: "", date_of_birth: "", sex: "unknown", nationality: "SA" });

  async function refresh() {
    try {
      const r = await ClinicalAPI.listBeneficiaries(q.trim() || undefined);
      setList(r.data as Beneficiary[]);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  async function loadCoverage(b: Beneficiary) {
    setSelected(b);
    try {
      const r = await ClinicalAPI.listCoverage(b.id);
      setCoverage(r.data);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }

  async function create() {
    if (!form.full_name || !form.document_id) return toast.error("Name and document ID required");
    try {
      await ClinicalAPI.createBeneficiary({ ...form, date_of_birth: form.date_of_birth || null });
      toast.success("Beneficiary registered");
      setCreating(false);
      setForm({ full_name: "", document_id: "", date_of_birth: "", sex: "unknown", nationality: "SA" });
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }

  return (
    <section className="grid lg:grid-cols-2 gap-4">
      <Card title="Beneficiaries" action={
        <button onClick={() => setCreating(true)} className="px-3 py-1.5 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground">
          + New
        </button>
      }>
        <div className="flex gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && refresh()}
            placeholder="Search name…"
            className="flex-1 h-9 px-3 rounded bg-input border border-hairline text-sm" />
          <button onClick={refresh} className="px-3 py-1.5 rounded mono text-[10px] uppercase tracking-widest border border-hairline">Search</button>
        </div>
        {creating && (
          <div className="rounded-lg border border-action/40 bg-action/5 p-3 mb-3 space-y-2">
            <Field label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full h-8 px-2 bg-input border border-hairline rounded text-sm" /></Field>
            <Field label="Document ID (Iqama/National ID)"><input value={form.document_id} onChange={(e) => setForm({ ...form, document_id: e.target.value })} className="w-full h-8 px-2 bg-input border border-hairline rounded text-sm" /></Field>
            <Field label="DOB"><input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="w-full h-8 px-2 bg-input border border-hairline rounded text-sm" /></Field>
            <Field label="Sex">
              <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} className="w-full h-8 px-2 bg-input border border-hairline rounded text-sm">
                <option value="male">male</option><option value="female">female</option><option value="unknown">unknown</option>
              </select>
            </Field>
            <div className="flex gap-2">
              <button onClick={create} className="flex-1 h-8 rounded mono text-[10px] uppercase tracking-widest bg-stable text-stable-foreground">Save</button>
              <button onClick={() => setCreating(false)} className="px-3 h-8 rounded mono text-[10px] uppercase tracking-widest border border-hairline">Cancel</button>
            </div>
          </div>
        )}
        <div className="divide-y divide-hairline max-h-[500px] overflow-auto">
          {list.length === 0 && <div className="p-4 text-xs text-muted-foreground">No beneficiaries.</div>}
          {list.map((b) => (
            <button key={b.id} onClick={() => loadCoverage(b)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-panel-elevated ${selected?.id === b.id ? "bg-action/10" : ""}`}>
              <div className="font-medium">{b.full_name}</div>
              <div className="mono text-[10px] text-muted-foreground">{b.document_id ?? "no document"}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card title={selected ? `Coverage · ${selected.full_name}` : "Coverage"}>
        {!selected ? (
          <div className="text-xs text-muted-foreground">Select a beneficiary to view coverage.</div>
        ) : (
          <CoverageList beneficiary={selected} coverage={coverage} onChange={() => loadCoverage(selected)} />
        )}
      </Card>
    </section>
  );
}

function CoverageList({ beneficiary, coverage, onChange }: { beneficiary: Beneficiary; coverage: any[]; onChange: () => void }) {
  const [payers, setPayers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ payer_id: "", network_id: "", insurance_plan_id: "", member_id: "" });

  useEffect(() => {
    Promise.all([
      ClinicalAPI.listMaster("payers").catch(() => ({ data: [] })),
      ClinicalAPI.listMaster("insurance-plans").catch(() => ({ data: [] })),
      ClinicalAPI.listMaster("networks").catch(() => ({ data: [] })),
    ]).then(([p, pl, n]) => { setPayers(p.data); setPlans(pl.data); setNetworks(n.data); });
  }, []);

  async function add() {
    if (!form.payer_id || !form.member_id) return toast.error("Payer + member_id required");
    try {
      await ClinicalAPI.createCoverage(beneficiary.id, form);
      toast.success("Coverage attached");
      setAdding(false);
      setForm({ payer_id: "", network_id: "", insurance_plan_id: "", member_id: "" });
      onChange();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-hairline">
        {coverage.length === 0 && <div className="text-xs text-muted-foreground py-2">No coverage on file.</div>}
        {coverage.map((c) => (
          <div key={c.id} className="py-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium">{payers.find(p => p.id === c.payer_id)?.name ?? c.payer_id?.slice(0, 8)}</div>
              <span className="mono text-[10px] px-2 py-0.5 rounded bg-stable/15 text-stable">{c.status ?? "active"}</span>
            </div>
            <div className="mono text-[10px] text-muted-foreground">Member {c.member_id} · plan {plans.find(p => p.id === c.insurance_plan_id)?.name ?? "—"}</div>
          </div>
        ))}
      </div>
      {!adding ? (
        <button onClick={() => setAdding(true)} className="w-full h-8 rounded border border-dashed border-hairline mono text-[10px] uppercase tracking-widest text-action">+ Attach coverage</button>
      ) : (
        <div className="rounded-lg border border-action/40 bg-action/5 p-3 space-y-2">
          <Field label="Payer">
            <select value={form.payer_id} onChange={(e) => setForm({ ...form, payer_id: e.target.value })} className="w-full h-8 px-2 bg-input border border-hairline rounded text-sm">
              <option value="">— select —</option>
              {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Network (optional)">
            <select value={form.network_id} onChange={(e) => setForm({ ...form, network_id: e.target.value })} className="w-full h-8 px-2 bg-input border border-hairline rounded text-sm">
              <option value="">—</option>
              {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </Field>
          <Field label="Plan (optional)">
            <select value={form.insurance_plan_id} onChange={(e) => setForm({ ...form, insurance_plan_id: e.target.value })} className="w-full h-8 px-2 bg-input border border-hairline rounded text-sm">
              <option value="">—</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Member ID">
            <input value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} className="w-full h-8 px-2 bg-input border border-hairline rounded text-sm" />
          </Field>
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 h-8 rounded mono text-[10px] uppercase tracking-widest bg-stable text-stable-foreground">Save</button>
            <button onClick={() => setAdding(false)} className="px-3 h-8 rounded mono text-[10px] uppercase tracking-widest border border-hairline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Encounters ───────── */

function EncountersPane() {
  const [list, setList] = useState<Encounter[]>([]);
  const [selected, setSelected] = useState<Encounter | null>(null);

  async function refresh() {
    try {
      const r = await ClinicalAPI.listEncounters();
      setList(r.data as Encounter[]);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <section className="grid lg:grid-cols-[400px_1fr] gap-4">
      <Card title="Encounters" action={<button onClick={refresh} className="text-action"><RefreshCw className="size-3.5" /></button>}>
        <div className="divide-y divide-hairline max-h-[600px] overflow-auto">
          {list.length === 0 && <div className="p-4 text-xs text-muted-foreground">No encounters.</div>}
          {list.map((e) => (
            <button key={e.id} onClick={() => setSelected(e)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-panel-elevated ${selected?.id === e.id ? "bg-action/10" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="mono text-[10px] uppercase tracking-widest text-action">{e.class}</span>
                <span className="mono text-[10px] text-muted-foreground">{new Date(e.started_at).toLocaleDateString()}</span>
              </div>
              <div className="text-xs text-muted-foreground">{e.journey_state}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card title={selected ? `Encounter · ${selected.class.toUpperCase()}` : "Select an encounter"}>
        {selected ? <EncounterDetail enc={selected} onChange={refresh} /> : <div className="text-xs text-muted-foreground">Pick an encounter from the list.</div>}
      </Card>
    </section>
  );
}

function EncounterDetail({ enc, onChange }: { enc: Encounter; onChange: () => void }) {
  const [vitals, setVitals] = useState({ systolic: "", diastolic: "", heart_rate: "", spo2: "" });
  const [dx, setDx] = useState({ code: "", display: "" });

  async function advance(action: "admit" | "discharge") {
    try {
      if (action === "admit") await ClinicalAPI.admit(enc.id, { admit_source: "emergency" });
      else await ClinicalAPI.discharge(enc.id, { discharge_disposition: "home", separation_mode: "routine" });
      toast.success(`Encounter ${action}ed`);
      onChange();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }
  async function saveVitals() {
    try {
      await ClinicalAPI.addVitals(enc.id, {
        systolic_bp: vitals.systolic ? Number(vitals.systolic) : null,
        diastolic_bp: vitals.diastolic ? Number(vitals.diastolic) : null,
        heart_rate: vitals.heart_rate ? Number(vitals.heart_rate) : null,
        spo2: vitals.spo2 ? Number(vitals.spo2) : null,
      });
      toast.success("Vitals recorded");
      setVitals({ systolic: "", diastolic: "", heart_rate: "", spo2: "" });
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }
  async function saveDx() {
    if (!dx.code) return toast.error("Diagnosis code required (ICD-10-AM)");
    try {
      await ClinicalAPI.addDiagnosis(enc.id, { code: dx.code, display: dx.display, rank: "secondary", role: "discharge" });
      toast.success("Diagnosis added");
      setDx({ code: "", display: "" });
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 mono text-[10px]">
        <Stat label="Journey" value={enc.journey_state} />
        <Stat label="Status" value={enc.status} />
        <Stat label="Reimbursement" value={enc.reimbursement_model} />
      </div>

      <div>
        <h4 className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Vitals</h4>
        <div className="grid grid-cols-4 gap-2">
          <input placeholder="SBP" value={vitals.systolic} onChange={(e) => setVitals({ ...vitals, systolic: e.target.value })} className="h-8 px-2 bg-input border border-hairline rounded text-sm" />
          <input placeholder="DBP" value={vitals.diastolic} onChange={(e) => setVitals({ ...vitals, diastolic: e.target.value })} className="h-8 px-2 bg-input border border-hairline rounded text-sm" />
          <input placeholder="HR" value={vitals.heart_rate} onChange={(e) => setVitals({ ...vitals, heart_rate: e.target.value })} className="h-8 px-2 bg-input border border-hairline rounded text-sm" />
          <input placeholder="SpO₂" value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} className="h-8 px-2 bg-input border border-hairline rounded text-sm" />
        </div>
        <button onClick={saveVitals} className="mt-2 px-3 h-8 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground">Record vitals</button>
      </div>

      <div>
        <h4 className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Diagnosis (ICD-10-AM)</h4>
        <div className="grid grid-cols-[140px_1fr_auto] gap-2">
          <input placeholder="Code e.g. J18.9" value={dx.code} onChange={(e) => setDx({ ...dx, code: e.target.value })} className="h-8 px-2 bg-input border border-hairline rounded text-sm mono" />
          <input placeholder="Display text" value={dx.display} onChange={(e) => setDx({ ...dx, display: e.target.value })} className="h-8 px-2 bg-input border border-hairline rounded text-sm" />
          <button onClick={saveDx} className="px-3 h-8 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground">Add</button>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-hairline">
        {enc.class === "inpatient" && enc.journey_state !== "admitted" && enc.journey_state !== "discharged" && (
          <button onClick={() => advance("admit")} className="px-3 h-9 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground flex items-center gap-2">
            <Hospital className="size-3.5" /> Admit
          </button>
        )}
        {(enc.journey_state === "admitted" || enc.journey_state === "active") && (
          <button onClick={() => advance("discharge")} className="px-3 h-9 rounded mono text-[10px] uppercase tracking-widest bg-stable text-stable-foreground flex items-center gap-2">
            <CheckCircle2 className="size-3.5" /> Discharge
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────── Coding & Grouper ───────── */

function CodingPane() {
  const [list, setList] = useState<Encounter[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await ClinicalAPI.listEncounters();
      setList((r.data as Encounter[]).filter((e) => e.class === "inpatient"));
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }
  useEffect(() => { refresh(); }, []);

  async function runGrouper(enc: Encounter) {
    setBusy(enc.id);
    try {
      const r = await ClinicalAPI.group(enc.id);
      toast.success(`Grouped → DRG ${(r.data as any)?.drg_code ?? "?"}`);
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(null); }
  }

  return (
    <Card title="AR-DRG Grouper · Inpatient encounters">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
            <th className="py-2">Encounter</th><th>Journey</th><th>Started</th><th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {list.length === 0 && <tr><td colSpan={4} className="py-4 text-xs text-muted-foreground">No inpatient encounters.</td></tr>}
          {list.map((e) => {
            const groupable = ["discharged", "coded"].includes(e.journey_state);
            return (
              <tr key={e.id}>
                <td className="py-2 mono text-[11px]">{e.id.slice(0, 8)}</td>
                <td className="py-2">{e.journey_state}</td>
                <td className="py-2 mono text-[10px] text-muted-foreground">{new Date(e.started_at).toLocaleDateString()}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => runGrouper(e)}
                    disabled={!groupable || busy === e.id}
                    className="px-3 h-7 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground disabled:opacity-40"
                  >
                    {busy === e.id ? "…" : "Run grouper"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/* ───────── Claims ───────── */

function ClaimsPane() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selected, setSelected] = useState<Claim | null>(null);
  const [bundle, setBundle] = useState<object | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  async function refresh() {
    try {
      const [e, c] = await Promise.all([
        ClinicalAPI.listEncounters(),
        ClinicalAPI.listClaims(statusFilter ? { status: statusFilter } : undefined),
      ]);
      setEncounters(e.data as Encounter[]);
      setClaims(c.data as Claim[]);
    } catch (err) {
      if (err instanceof ClinicalApiError) toast.error(err.message);
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [statusFilter]);

  async function assemble(enc: Encounter) {
    try {
      const r = await ClinicalAPI.assembleClaim(enc.id);
      toast.success("Claim assembled");
      setSelected((r.data as any).claim as Claim);
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }
  async function markReady(id: string) {
    try { await ClinicalAPI.markClaimReady(id); toast.success("Marked ready"); refresh(); }
    catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }
  async function submit(id: string) {
    try { await ClinicalAPI.submitClaim(id, "Phase-7 stub submission"); toast.success("Submitted (stub)"); refresh(); }
    catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }
  async function loadBundle(id: string) {
    try { const b = await ClinicalAPI.getClaimFhir(id); setBundle((b ?? null) as object | null); }
    catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
  }

  const assemblable = useMemo(
    () => encounters.filter((e) =>
      (e.reimbursement_model === "drg_bundled" && ["grouped", "coded"].includes(e.journey_state)) ||
      (e.reimbursement_model !== "drg_bundled" && e.journey_state === "discharged"),
    ),
    [encounters],
  );

  return (
    <section className="space-y-4">
      <Card title="Encounters ready for claim assembly">
        {assemblable.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nothing ready — discharge an OP/ER encounter or run the grouper on an IP encounter.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {assemblable.map((e) => (
              <div key={e.id} className="rounded-lg border border-hairline bg-panel-elevated p-3 flex items-center justify-between">
                <div>
                  <div className="mono text-[10px] uppercase tracking-widest text-action">{e.class}</div>
                  <div className="mono text-[11px] text-muted-foreground">{e.id.slice(0, 8)} · {e.journey_state}</div>
                </div>
                <button onClick={() => assemble(e)} className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest bg-action text-action-foreground">Assemble</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Claims" action={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-7 px-2 bg-input border border-hairline rounded mono text-[10px]">
          <option value="">All</option>
          <option value="draft">draft</option>
          <option value="ready">ready</option>
          <option value="submitted">submitted</option>
        </select>
      }>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-hairline">
              <th className="py-2">Claim</th><th>Model</th><th>Status</th><th>Patient</th><th>Payer</th><th>Total</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {claims.length === 0 && <tr><td colSpan={7} className="py-4 text-xs text-muted-foreground">No claims yet.</td></tr>}
            {claims.map((c) => (
              <tr key={c.id} className={selected?.id === c.id ? "bg-action/5" : ""}>
                <td className="py-2 mono text-[11px]">{c.provider_claim_no ?? c.id.slice(0, 8)}</td>
                <td className="py-2 mono text-[10px]">{c.billing_model}</td>
                <td className="py-2"><StatusPill status={c.status} /></td>
                <td className="py-2 mono text-[11px]">{fmtMinor(c.total_patient_share_minor, c.currency)}</td>
                <td className="py-2 mono text-[11px]">{fmtMinor(c.total_payer_share_minor, c.currency)}</td>
                <td className="py-2 mono text-[11px] font-bold">{fmtMinor(c.total_net_minor, c.currency)}</td>
                <td className="py-2 text-right space-x-1">
                  <button onClick={() => { setSelected(c); loadBundle(c.id); }} className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest border border-hairline">FHIR</button>
                  {c.status === "draft" && <button onClick={() => markReady(c.id)} className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest bg-caution/20 text-caution">Ready</button>}
                  {(c.status === "draft" || c.status === "ready") && <button onClick={() => submit(c.id)} className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest bg-stable text-stable-foreground"><Send className="size-3 inline" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {selected && bundle ? (
        <Card title={`FHIR Bundle · ${selected.provider_claim_no ?? selected.id.slice(0, 8)}`}>
          <pre className="text-[10px] mono bg-panel-elevated p-3 rounded-lg overflow-auto max-h-[400px]">{JSON.stringify(bundle, null, 2)}</pre>
        </Card>
      ) : null}
    </section>
  );
}

/* ───────── primitives ───────── */

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-panel">
      <div className="px-4 py-2.5 border-b border-hairline mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
        <span>{title}</span>{action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-panel-elevated p-2">
      <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    ready: "bg-caution/20 text-caution",
    submitted: "bg-action/20 text-action",
    adjudicated: "bg-stable/20 text-stable",
    paid: "bg-stable/20 text-stable",
    rejected: "bg-emergency/20 text-emergency",
  };
  return <span className={`mono text-[10px] px-2 py-0.5 rounded ${map[status] ?? "bg-muted"}`}>{status}</span>;
}