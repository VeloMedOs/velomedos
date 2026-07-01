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
import {
  RefreshCw, ShieldCheck, AlertTriangle, CheckCircle2, FileText, XCircle, Search,
} from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";
import { DCard } from "./Primitives";
import { CapGate } from "./CapGate";
import { ExceptionCaptureDrawer } from "./ExceptionCaptureDrawer";
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
  eligibility_ref_no?: string | null;
  membership_id?: string | null;
  payer_id?: string | null;
  policy_id?: string | null;
  class_id?: string | null;
  network_id?: string | null;
  eligibility_type?: string | null;
  result_payload?: Record<string, unknown> | null;
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
  const [bucketFilter, setBucketFilter] = useState<EligibilityBucket | "">("");
  const [finTypeFilter, setFinTypeFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [exceptionFor, setExceptionFor] = useState<string | null>(null);
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

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (bucketFilter && bucketOfEligibility(r.status) !== bucketFilter) return false;
      if (finTypeFilter && (r.financial_type ?? "pending") !== finTypeFilter) return false;
      if (s) {
        const hay = [r.id, r.beneficiary_id, r.encounter_id, r.eligibility_ref_no, r.membership_id]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, bucketFilter, finTypeFilter, search]);

  const buckets = useMemo(() => {
    const map: Record<EligibilityBucket, Row[]> = { needs_me_now: [], in_flight: [], cleared: [], dead: [] };
    for (const r of filteredRows) map[bucketOfEligibility(r.status)].push(r);
    return map;
  }, [filteredRows]);

  const allVisibleIds = useMemo(() => filteredRows.map((r) => r.id), [filteredRows]);
  const allSelected  = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allVisibleIds));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectedRows(): Row[] {
    return filteredRows.filter((r) => selected.has(r.id));
  }

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

  /* ─────────── Bulk actions (Promise.allSettled over single-item endpoints) ─────────── */

  async function runBulk(label: string, key: string, runOne: (r: Row) => Promise<unknown>) {
    const rowsSel = selectedRows();
    if (rowsSel.length === 0) return;
    setBulkBusy(key);
    const results = await Promise.allSettled(rowsSel.map(runOne));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - ok;
    if (failed === 0) toast.success(`${label} · ${ok} updated`);
    else {
      const firstErr = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      const msg = firstErr?.reason instanceof ClinicalApiError ? firstErr.reason.message : "See console";
      toast.error(`${label} · ${ok} ok · ${failed} failed — first: ${msg}`);
    }
    setSelected(new Set());
    setBulkBusy(null);
    refresh();
  }
  const bulkRecheck = () => runBulk("Re-check", "recheck",
    (r) => ClinicalAPI.checkEligibility({ beneficiary_id: r.beneficiary_id, coverage_id: r.coverage_id ?? null, encounter_id: r.encounter_id ?? null }));
  const bulkRequestActivation = () => runBulk("Request activation", "activation",
    (r) => ClinicalAPI.transitionEligibility(r.id, "activation.request", "Bulk worklist action"));
  const bulkSelfPay = () => runBulk("Mark self-pay", "self_pay",
    (r) => ClinicalAPI.transitionEligibility(r.id, "select.self_pay", "Bulk self-pay"));
  const bulkCancel = () => runBulk("Cancel", "cancel",
    (r) => ClinicalAPI.transitionEligibility(r.id, "cancel", "Bulk cancel"));

  return (
    <div className="px-7 pt-6 pb-14 mx-auto space-y-4" style={{ maxWidth: 1240, width: "100%" }}>
      <DCard
        title="Eligibility & activation"
        caption="R1 · visit_eligibility · financial-type-locked coverage"
        icon={ShieldCheck}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 clin-ctrl mono" style={{ height: 32, padding: "4px 8px", width: 180 }}>
              <Search className="size-3" style={{ color: "var(--clin-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                     placeholder="Search id / ref / membership"
                     className="bg-transparent outline-none w-full mono text-[11px]" />
            </label>
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
            <select value={finTypeFilter} onChange={(e) => setFinTypeFilter(e.target.value)}
                    className="clin-ctrl mono" style={{ height: 32, padding: "4px 8px", width: 130 }}>
              <option value="">Any fin. type</option>
              <option value="insurance">insurance</option>
              <option value="self_pay">self_pay</option>
              <option value="pending">pending</option>
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
            const active = bucketFilter === b;
            return (
              <button key={b}
                type="button"
                onClick={() => setBucketFilter(active ? "" : b)}
                className="rounded-xl p-3 text-left transition-colors"
                style={{
                  background: active ? "var(--clin-teal-tint)" : "var(--clin-raised)",
                  border: `1px solid ${active ? "var(--teal)" : "var(--hairline)"}`,
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="size-4" style={{ color: "var(--clin-muted)" }} />
                  <span className="text-[12px] font-semibold" style={{ color: "var(--clin-text)" }}>{meta.label}</span>
                </div>
                <div className="mono text-[22px] font-bold" style={{ color: "var(--clin-ink)" }}>{buckets[b].length}</div>
                <div className="text-[11px]" style={{ color: "var(--clin-muted)" }}>{meta.caption}</div>
              </button>
            );
          })}
        </div>

        {!readOnly && selected.size > 0 && (
          <div className="sticky top-[60px] z-[8] flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
               style={{ background: "var(--clin-teal-tint)", border: "1px solid var(--teal)" }}>
            <span className="mono text-[11px] font-semibold" style={{ color: "var(--teal)" }}>
              {selected.size} selected
            </span>
            <div className="flex-1" />
            <BulkBtn onClick={bulkRecheck} busy={bulkBusy === "recheck"} label="Re-check" />
            <BulkBtn onClick={bulkRequestActivation} busy={bulkBusy === "activation"} label="Request activation" />
            <BulkBtn onClick={bulkSelfPay} busy={bulkBusy === "self_pay"} label="Mark self-pay" />
            <BulkBtn onClick={bulkCancel} busy={bulkBusy === "cancel"} label="Cancel" tone="crit" />
            <button onClick={() => setSelected(new Set())} className="p-1 rounded hover:bg-black/5" aria-label="Clear selection">
              <XCircle className="size-4" style={{ color: "var(--clin-muted)" }} />
            </button>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest border-b"
                style={{ color: "var(--clin-muted)", borderColor: "var(--hairline)" }}>
              {!readOnly && (
                <th className="py-2 pl-1 pr-2 w-6">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all in view" />
                </th>
              )}
              <th className="py-2 pr-3">Eligibility</th>
              <th className="pr-3">Status</th>
              <th className="pr-3">Financial type</th>
              <th className="pr-3">Exception</th>
              <th className="pr-3">Payer/Policy</th>
              <th className="pr-3">NPHIES ref</th>
              <th className="pr-3">Encounter</th>
              <th className="pr-3">Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={readOnly ? 8 : 9} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>Loading eligibility rows…</td></tr>
            )}
            {!loading && filteredRows.length === 0 && (
              <tr><td colSpan={readOnly ? 8 : 9} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
                Nothing here. Register a patient and run an eligibility check to populate this worklist.
              </td></tr>
            )}
            {filteredRows.map((r) => {
              const tone = toneOfEligibility(r.status);
              const canRequestAct = ["eligible", "exception_approved"].includes(r.status);
              const canRecheck = ["new", "error", "not_eligible", "activation_pending"].includes(r.status);
              const canRaiseException = ["not_eligible", "error", "new"].includes(r.status);
              const finType = r.financial_type ?? "pending";
              const nphiesRef = r.eligibility_ref_no
                ?? (r.result_payload as any)?.eligibility_ref_no
                ?? (r.result_payload as any)?.reference_no
                ?? null;
              const excType = (r.result_payload as any)?.exception_type ?? r.eligibility_type ?? null;
              const isSel = selected.has(r.id);
              return (
                <tr key={r.id} style={{ borderTop: "1px solid var(--hairline)", background: isSel ? "var(--clin-teal-tint)" : undefined }}>
                  {!readOnly && (
                    <td className="py-2 pl-1 pr-2">
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(r.id)} aria-label={`Select ${r.id}`} />
                    </td>
                  )}
                  <td className="py-2 pr-3 mono text-[11px]">{r.id.slice(0, 8)}</td>
                  <td className="pr-3">
                    <span className="mono text-[10.5px] uppercase tracking-wider rounded-full px-2 py-0.5"
                          style={{ ...toneStyle(tone), border: "1px solid var(--hairline)" }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="pr-3 mono text-[11px]">
                    <span className="rounded-full px-2 py-0.5 border" style={{
                      background: finType === "insurance" ? "var(--clin-teal-tint)" : finType === "self_pay" ? "var(--clin-sunken)" : "var(--clin-warn-tint)",
                      color:      finType === "insurance" ? "var(--teal)"          : finType === "self_pay" ? "var(--clin-muted)" : "var(--clin-warn)",
                      borderColor: "var(--hairline)",
                    }}>{finType}</span>
                  </td>
                  <td className="pr-3 mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>{excType ?? "—"}</td>
                  <td className="pr-3 mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
                    {(r.payer_id ? r.payer_id.slice(0, 8) : "—")}{r.policy_id ? ` · ${r.policy_id.slice(0, 8)}` : ""}
                  </td>
                  <td className="pr-3 mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>{nphiesRef ?? "—"}</td>
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
                      <button
                        onClick={() => setExceptionFor(r.id)}
                        disabled={!canRaiseException || busy === r.id}
                        className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest disabled:opacity-40"
                        style={{ background: "var(--clin-warn-tint)", color: "var(--clin-warn)" }}
                        title={canRaiseException ? "Capture referral/emergency/newborn evidence" : "Only new/not_eligible/error rows can raise an exception"}
                      >
                        Exception
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

      {exceptionFor && (
        <ExceptionCaptureDrawer
          visitEligibilityId={exceptionFor}
          onClose={() => setExceptionFor(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function BulkBtn({ onClick, busy, label, tone }: { onClick: () => void; busy: boolean; label: string; tone?: "crit" }) {
  const critical = tone === "crit";
  return (
    <button onClick={onClick} disabled={busy}
            className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest disabled:opacity-40"
            style={{
              background: critical ? "var(--clin-crit-tint)" : "#fff",
              color:      critical ? "var(--clin-crit)"      : "var(--clin-text)",
              border: "1px solid var(--hairline)",
            }}>
      {busy ? "…" : label}
    </button>
  );
}