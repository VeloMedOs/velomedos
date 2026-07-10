import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, RefreshCw, Send, Hospital, CheckCircle2 } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { useClinicalMe } from "@/lib/clinical-roles";
import { ClaimCompletenessPanel } from "@/components/clinical/ClaimCompletenessPanel";
import { OutcomesPane } from "@/components/clinical/OutcomesPane";
import { DaylightShell, type TabId } from "@/components/clinical/daylight/Shell";
import { RegistrationPane } from "@/components/clinical/daylight/RegistrationPane";
import { E2bRegistrationPane } from "@/components/clinical/daylight/E2bRegistrationPane";
import { ClinicDisruptionPane } from "@/components/clinical/daylight/ClinicDisruptionPane";
import { EncounterPane } from "@/components/clinical/daylight/EncounterPane";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { EligibilityWorklistPane } from "@/components/clinical/daylight/EligibilityWorklistPane";
import { ContractsPane } from "@/components/clinical/daylight/ContractsPane";
import { PolicyActivationPane } from "@/components/clinical/daylight/PolicyActivationPane";
import { ContractMastersPane } from "@/components/clinical/daylight/ContractMastersPane";
import { ClaimsWorklistPane } from "@/components/clinical/daylight/ClaimsWorklistPane";
import {
  RcmHubPane, AuthorizationPane,
  DepositsPane, CashPane,
  VitalsTrendPane,
} from "@/components/clinical/daylight/RcmStubs";
import { IpAdmissionsPane } from "@/components/clinical/daylight/IpAdmissionsPane";
import { OrdersPane } from "@/components/clinical/daylight/OrdersPane";
import { ResultsPane } from "@/components/clinical/daylight/ResultsPane";
import { ClinicDayBoardPane } from "@/components/clinical/daylight/scheduling/ClinicDayBoardPane";
import { ScheduleSetupPane } from "@/components/clinical/daylight/scheduling/ScheduleSetupPane";
import { CashierWorklistPane } from "@/components/clinical/daylight/worklists/CashierWorklistPane";
import { RoutingBoardPane } from "@/components/clinical/daylight/worklists/RoutingBoardPane";
import { TreatmentRoomPane } from "@/components/clinical/daylight/worklists/TreatmentRoomPane";
import { ALL_NAV_TABS } from "@/components/clinical/daylight/nav-config";
import { formatHalalas } from "@/lib/clinical/format-money";
import { DoctorWorklistPane } from "@/components/clinical/daylight/worklists/DoctorWorklistPane";
import { NursingWorkbenchPane } from "@/components/clinical/daylight/worklists/NursingWorkbenchPane";
import { ClinicalFormsWorklistPane } from "@/components/clinical/daylight/worklists/ClinicalFormsWorklistPane";
import { RcmCommsInboxPane } from "@/components/clinical/daylight/worklists/RcmCommsInboxPane";
import {
  EmsPane, FrontOfficePane, AdmissionPane, FloorManagerPane, TransferDischargePane,
  CoderPane as CoderModulePane, MrdPane, PharmacistPane, NutritionPane, SocialWorkPane,
} from "@/components/clinical/daylight/worklists/module-panes";

const TAB_VALUES = ALL_NAV_TABS as [string, ...string[]];

export const Route = createFileRoute("/_authenticated/clinical")({
  validateSearch: z.object({
    tab: z.enum(TAB_VALUES).optional(),
    class: z.enum(["AMB", "EMER", "IMP", "HH", "VR"]).optional(),
  }),
  head: () => ({ meta: [{ title: "Clinical Workspace · VeloMed OS" }] }),
  component: ClinicalWorkspace,
});

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
  return formatHalalas(n, { currency: cur });
}

function ClinicalWorkspace() {
  const { me, loading, error } = useClinicalMe();
  const search = useSearch({ from: "/_authenticated/clinical" });
  const [tab, setTab] = useState<TabId>((search.tab as TabId) ?? "registration");
  useEffect(() => { if (search.tab) setTab(search.tab as TabId); }, [search.tab]);

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

  const initials = (me.clinicalRole ?? "ME").slice(0, 2).toUpperCase();
  const roleLabel = (me.clinicalRole ?? "clinical").replace(/_/g, " ");

  return (
    <DaylightShell tab={tab} onTab={setTab} role={me.clinicalRole} initials={initials} roleLabel={roleLabel}>
      {tab === "registration"        && <RegistrationPane />}
      {(tab as string) === "opd-registration-e2b" && <E2bRegistrationPane />}
      {(tab as string) === "opd-disruption"       && <ClinicDisruptionPane />}
      {tab === "encounters"          && <EncounterPane />}
      {tab === "coding"              && <CodingPane />}
      {(tab === "claims" || tab === "rcm-claims") && <ClaimsWorklistPane role={me.clinicalRole} />}
      {tab === "rcm"                 && <RcmHubPane />}
      {tab === "rcm-eligibility"     && <EligibilityWorklistPane role={me.clinicalRole} />}
      {tab === "rcm-activation"      && <PolicyActivationPane role={me.clinicalRole} />}
      {tab === "rcm-authorization"   && <AuthorizationPane />}
      {tab === "finance-billing-op"  && <CashierWorklistPane />}
      {(tab as string) === "opd-cashier" && <CashierWorklistPane />}
      {(tab as string) === "opd-routing" && <RoutingBoardPane />}
      {tab === "finance-billing-ip"  && <IpAdmissionsPane role={me.clinicalRole} />}
      {tab === "finance-deposits"    && <DepositsPane />}
      {tab === "finance-cash"        && <CashPane />}
      {tab === "billing"             && <CashierWorklistPane />}
      {tab === "admin-masters"       && <ContractsPane role={me.clinicalRole} />}
      {tab === "admin-contract-masters" && <ContractMastersPane role={me.clinicalRole} />}
      {tab === "orders"              && <OrdersPane />}
      {tab === "results"             && <ResultsPane />}
      {tab === "opd-day-board"       && <ClinicDayBoardPane />}
      {tab === "opd-schedule-setup"  && <ScheduleSetupPane />}
      {tab === "opd-treatment-room"  && <TreatmentRoomPane />}
      {tab === "vitals"              && <VitalsTrendPane />}
      {tab === "wl-doctor"           && <DoctorWorklistPane />}
      {tab === "wl-nursing"          && <NursingWorkbenchPane />}
      {tab === "forms-worklist"      && <ClinicalFormsWorklistPane />}
      {tab === "rcm-comms"           && <RcmCommsInboxPane />}
      {tab === "wl-ems"              && <EmsPane />}
      {tab === "wl-front-office"     && <FrontOfficePane />}
      {tab === "wl-admission"        && <AdmissionPane />}
      {tab === "wl-floor-manager"    && <FloorManagerPane />}
      {tab === "wl-transfer-discharge" && <TransferDischargePane />}
      {tab === "wl-coder"            && <CoderModulePane />}
      {tab === "wl-mrd"              && <MrdPane />}
      {tab === "wl-pharmacist"       && <PharmacistPane />}
      {tab === "wl-nutrition"        && <NutritionPane />}
      {tab === "wl-social-work"      && <SocialWorkPane />}
      {tab === "vbhc"                && (
        <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1200, width: "100%" }}>
          <OutcomesPane />
        </div>
      )}
    </DaylightShell>
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
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1200, width: "100%" }}>
    <DCard title="AR-DRG grouper" caption="Inpatient encounters · awaiting DRG assignment">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left mono text-[10px] uppercase tracking-widest border-b" style={{ color: "var(--clin-muted)", borderColor: "var(--hairline)" }}>
            <th className="py-2">Encounter</th><th>Journey</th><th>Started</th><th></th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={4} className="py-4 text-xs" style={{ color: "var(--clin-muted)" }}>No inpatient encounters.</td></tr>}
          {list.map((e) => {
            const groupable = ["discharged", "coded"].includes(e.journey_state);
            return (
              <tr key={e.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                <td className="py-2 mono text-[11px]">{e.id.slice(0, 8)}</td>
                <td className="py-2">{e.journey_state}</td>
                <td className="py-2 mono text-[10px]" style={{ color: "var(--clin-muted)" }}>{new Date(e.started_at).toLocaleDateString()}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => runGrouper(e)}
                    disabled={!groupable || busy === e.id}
                    className="px-3 h-7 rounded mono text-[10px] uppercase tracking-widest text-white disabled:opacity-40"
                    style={{ background: "var(--teal)" }}
                  >
                    {busy === e.id ? "…" : "Run grouper"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DCard>
    </div>
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
    catch (e) {
      if (e instanceof ClinicalApiError) {
        const miss = (e.payload as any)?.missing as Array<{ message: string }> | undefined;
        const first = miss?.slice(0, 3).map((m) => `• ${m.message}`).join("\n");
        toast.error(first ? `${e.message}\n${first}` : e.message);
        setSelected((s) => (s && s.id === id ? s : s));
      }
    }
  }
  async function submit(id: string) {
    try { await ClinicalAPI.submitClaim(id, "Phase-9 NPHIES submission"); toast.success("Submitted"); refresh(); }
    catch (e) {
      if (e instanceof ClinicalApiError) {
        const miss = (e.payload as any)?.missing as Array<{ message: string }> | undefined;
        const first = miss?.slice(0, 3).map((m) => `• ${m.message}`).join("\n");
        toast.error(first ? `${e.message}\n${first}` : e.message);
      }
    }
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
    <section className="px-7 pt-6 pb-14 mx-auto space-y-4" style={{ maxWidth: 1200, width: "100%" }}>
      <DCard title="Encounters ready for claim assembly" caption="Discharged OP/ER · grouped IP">
        {assemblable.length === 0 ? (
          <div className="text-xs" style={{ color: "var(--clin-muted)" }}>Nothing ready — discharge an OP/ER encounter or run the grouper on an IP encounter.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            {assemblable.map((e) => (
              <div key={e.id} className="rounded-lg p-3 flex items-center justify-between" style={{ background: "var(--clin-raised)", border: "1px solid var(--hairline)" }}>
                <div>
                  <div className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--teal)" }}>{e.class}</div>
                  <div className="mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{e.id.slice(0, 8)} · {e.journey_state}</div>
                </div>
                <button onClick={() => assemble(e)} className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest text-white" style={{ background: "var(--teal)" }}>Assemble</button>
              </div>
            ))}
          </div>
        )}
      </DCard>

      <DCard title="Claims" caption="NPHIES submission queue" action={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="clin-ctrl mono" style={{ height: 32, padding: "4px 8px", width: 120 }}>
          <option value="">All</option>
          <option value="draft">draft</option>
          <option value="ready">ready</option>
          <option value="submitted">submitted</option>
        </select>
      }>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest border-b" style={{ color: "var(--clin-muted)", borderColor: "var(--hairline)" }}>
              <th className="py-2">Claim</th><th>Model</th><th>Status</th><th>Patient</th><th>Payer</th><th>Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 && <tr><td colSpan={7} className="py-4 text-xs" style={{ color: "var(--clin-muted)" }}>No claims yet.</td></tr>}
            {claims.map((c) => (
              <tr key={c.id} style={{ background: selected?.id === c.id ? "var(--clin-teal-tint)" : undefined, borderTop: "1px solid var(--hairline)" }}>
                <td className="py-2 mono text-[11px]">{c.provider_claim_no ?? c.id.slice(0, 8)}</td>
                <td className="py-2 mono text-[10px]">{c.billing_model}</td>
                <td className="py-2"><StatusPill status={c.status} /></td>
                <td className="py-2 mono text-[11px]">{fmtMinor(c.total_patient_share_minor, c.currency)}</td>
                <td className="py-2 mono text-[11px]">{fmtMinor(c.total_payer_share_minor, c.currency)}</td>
                <td className="py-2 mono text-[11px] font-bold">{fmtMinor(c.total_net_minor, c.currency)}</td>
                <td className="py-2 text-right space-x-1">
                  <button onClick={() => { setSelected(c); loadBundle(c.id); }} className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest" style={{ border: "1px solid var(--hairline)", color: "var(--clin-text)" }}>FHIR</button>
                  {c.status === "draft" && <button onClick={() => markReady(c.id)} className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest" style={{ background: "var(--clin-warn-tint)", color: "var(--clin-warn)" }}>Ready</button>}
                  {(c.status === "draft" || c.status === "ready") && <button onClick={() => submit(c.id)} className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest text-white" style={{ background: "var(--clin-ok)" }}><Send className="size-3 inline" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DCard>

      {selected && bundle ? (
        <DCard title={`FHIR bundle · ${selected.provider_claim_no ?? selected.id.slice(0, 8)}`} caption="NPHIES wire format">
          <pre className="text-[10px] mono p-3 rounded-lg overflow-auto max-h-[400px]" style={{ background: "var(--clin-sunken)", color: "var(--clin-ink)" }}>{JSON.stringify(bundle, null, 2)}</pre>
        </DCard>
      ) : null}

      {selected && (
        <ClaimCompletenessPanel
          claimId={selected.id}
          showReadyButton={selected.status === "draft"}
          onReadyClick={() => markReady(selected.id)}
        />
      )}
    </section>
  );
}

/* ───────── primitives ───────── */

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "muted", ready: "warn", submitted: "info",
    adjudicated: "ok", paid: "ok", rejected: "crit",
  };
  return <span className={`clin-pill ${map[status] ?? "muted"}`}>{status}</span>;
}