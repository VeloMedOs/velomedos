/**
 * R1 · Eligibility & activation worklist (Daylight).
 *
 * Three-Second-Rule: rows are bucketed into "Needs me now", "In flight",
 * "Cleared" using {@link bucketOfEligibility}. Status chips read from the
 * real `visit_eligibility.status` tokens. All money elsewhere in RCM is
 * rendered via `formatHalalas` — this pane is pre-billing so it renders
 * only status + IDs.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, ShieldCheck, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";
import { DCard } from "./Primitives";
import { CapGate } from "./CapGate";
import {
  bucketOfEligibility, toneOfEligibility, toneStyle, type EligibilityBucket,
} from "@/lib/clinical/clinical-status";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = {
  id: string;
  encounter_id: string | null;
  beneficiary_id: string;
  coverage_id: string | null;
  financial_type: string | null;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string | null;
};

const BUCKET_META: Record<EligibilityBucket, { label: string; caption: string; icon: any }> = {
  needs_me_now: { label: "Needs me now",  caption: "New · errors · exception review", icon: AlertTriangle },
  in_flight:    { label: "In flight",     caption: "Checking · awaiting activation", icon: RefreshCw },
  cleared:      { label: "Cleared",       caption: "Eligible · activated · insured",  icon: CheckCircle2 },
  dead:         { label: "Closed",        caption: "Self-pay · cancelled",            icon: FileText },
};

const BUCKET_ORDER: EligibilityBucket[] = ["needs_me_now", "in_flight", "cleared", "dead"];

export function EligibilityWorklistPane({ role }: { role: ClinicalRole | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const readOnly = !canPerform(role, "reg.eligibility");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ClinicalAPI.listEligibility(statusFilter ? { status: statusFilter, limit: 100 } : { limit: 100 });
      setRows((r.data as Row[]) ?? []);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const buckets = useMemo(() => {
    const map: Record<EligibilityBucket, Row[]> = { needs_me_now: [], in_flight: [], cleared: [], dead: [] };
    for (const r of rows) map[bucketOfEligibility(r.status)].push(r);
    return map;
  }, [rows]);

  async function recheck(row: Row) {
    setBusy(row.id);
    try {
      await ClinicalAPI.checkEligibility({
        beneficiary_id: row.beneficiary_id,
        coverage_id: row.coverage_id ?? null,
        encounter_id: row.encounter_id ?? null,
      });
      toast.success("Re-check submitted");
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(null); }
  }

  async function requestActivation(row: Row) {
    setBusy(row.id);
    try {
      await ClinicalAPI.transitionEligibility(row.id, "activation.request", "Manual worklist action");
      toast.success("Activation requested");
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(null); }
  }

  async function toSelfPay(row: Row) {
    setBusy(row.id);
    try {
      await ClinicalAPI.transitionEligibility(row.id, "select.self_pay", "Patient chose self-pay");
      toast.success("Marked self-pay");
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(null); }
  }

  return (
    <div className="px-7 pt-6 pb-14 mx-auto space-y-4" style={{ maxWidth: 1240, width: "100%" }}>
      <DCard
        title="Eligibility & activation"
        caption="R1 · visit_eligibility · financial-type-locked coverage"
        icon={ShieldCheck}
        action={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="clin-ctrl mono"
              style={{ height: 32, padding: "4px 8px", width: 170 }}
            >
              <option value="">All statuses</option>
              <option value="new">new</option>
              <option value="checking">checking</option>
              <option value="eligible">eligible</option>
              <option value="not_eligible">not_eligible</option>
              <option value="error">error</option>
              <option value="exception_review">exception_review</option>
              <option value="activation_pending">activation_pending</option>
              <option value="activated">activated</option>
              <option value="insured">insured</option>
              <option value="self_pay">self_pay</option>
              <option value="cancelled">cancelled</option>
            </select>
            <button
              onClick={refresh}
              className="clin-ctrl mono flex items-center gap-1"
              style={{ height: 32, padding: "4px 10px" }}
            >
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>
        }
        status={readOnly ? <span className="clin-pill muted">View only</span> : undefined}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {BUCKET_ORDER.map((b) => {
            const meta = BUCKET_META[b];
            const Icon = meta.icon;
            return (
              <div key={b} className="rounded-xl p-3" style={{ background: "var(--clin-raised)", border: "1px solid var(--hairline)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="size-4" style={{ color: "var(--clin-muted)" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "var(--clin-text)" }}>{meta.label}</span>
                </div>
                <div className="mono text-[22px] font-bold" style={{ color: "var(--clin-ink)" }}>{buckets[b].length}</div>
                <div className="text-[11px]" style={{ color: "var(--clin-muted)" }}>{meta.caption}</div>
              </div>
            );
          })}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest border-b"
                style={{ color: "var(--clin-muted)", borderColor: "var(--hairline)" }}>
              <th className="py-2 pr-3">Eligibility</th>
              <th className="pr-3">Status</th>
              <th className="pr-3">Financial type</th>
              <th className="pr-3">Encounter</th>
              <th className="pr-3">Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>Loading eligibility rows…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
                Nothing here. Register a patient and run an eligibility check to populate this worklist.
              </td></tr>
            )}
            {rows.map((r) => {
              const tone = toneOfEligibility(r.status);
              const canRequestAct = ["eligible", "exception_approved"].includes(r.status);
              const canRecheck = ["new", "error", "not_eligible", "activation_pending"].includes(r.status);
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td className="py-2 pr-3 mono text-[11px]">{r.id.slice(0, 8)}</td>
                  <td className="pr-3">
                    <span className="mono text-[10.5px] uppercase tracking-wider rounded-full px-2 py-0.5"
                          style={{ ...toneStyle(tone), border: "1px solid var(--hairline)" }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="pr-3 mono text-[11px]" style={{ color: "var(--clin-text)" }}>{r.financial_type ?? "—"}</td>
                  <td className="pr-3 mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{r.encounter_id ? r.encounter_id.slice(0, 8) : "—"}</td>
                  <td className="pr-3 mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
                    {new Date(r.updated_at ?? r.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 text-right space-x-1">
                    <CapGate role={role} cap="reg.eligibility">
                      <button
                        onClick={() => recheck(r)}
                        disabled={!canRecheck || busy === r.id}
                        className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest disabled:opacity-40"
                        style={{ border: "1px solid var(--hairline)", color: "var(--clin-text)" }}
                        title={canRecheck ? "Re-check via NPHIES" : "Not re-checkable in this state"}
                      >
                        Re-check
                      </button>
                    </CapGate>
                    <CapGate role={role} cap="reg.activation">
                      <button
                        onClick={() => requestActivation(r)}
                        disabled={!canRequestAct || busy === r.id}
                        className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest text-white disabled:opacity-40"
                        style={{ background: "var(--teal)" }}
                        title={canRequestAct ? "Request policy activation" : "Only eligible / exception-approved rows can activate"}
                      >
                        Request activation
                      </button>
                      <button
                        onClick={() => toSelfPay(r)}
                        disabled={busy === r.id || ["insured", "self_pay", "cancelled", "activated"].includes(r.status)}
                        className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest disabled:opacity-40"
                        style={{ background: "var(--clin-sunken)", color: "var(--clin-muted)", border: "1px solid var(--hairline)" }}
                      >
                        Self-pay
                      </button>
                    </CapGate>
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