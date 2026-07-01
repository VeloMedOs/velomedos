/**
 * R1 · Contracts & change requests (Daylight, read-first).
 *
 * Left  · payer_agreement master (governed, non-editable here).
 * Right · contract_change_request queue — draft / approved / applied / rejected
 *         with a before-vs-after JSON diff. Actions: Approve (if role has
 *         `contract.change`), Apply (if role has `contract.manage`).
 *
 * All governed edits still round-trip through the existing CRUD + approve /
 * apply routes; this pane is a viewer + gated action surface only.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, GitPullRequest, CheckCircle2, RefreshCw } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";
import { DCard } from "./Primitives";
import { CapGate } from "./CapGate";
import { toneOfContractChange, toneStyle } from "@/lib/clinical/clinical-status";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Agreement = {
  id: string;
  payer_id: string;
  tpa_id: string | null;
  agreement_no: string;
  contract_start: string;
  contract_end: string | null;
  settlement_terms_days: number | null;
  vat_treatment: string | null;
  active: boolean;
};
type ChangeReq = {
  id: string;
  target_table: string;
  target_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  status: string;
  reason: string | null;
  effective_date: string | null;
  created_at: string;
};

export function ContractsPane({ role }: { role: ClinicalRole | null }) {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [changes, setChanges] = useState<ChangeReq[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChangeReq | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([
        ClinicalAPI.listPayerAgreements(),
        ClinicalAPI.listContractChangeRequests(statusFilter ? { status: statusFilter } : undefined),
      ]);
      setAgreements((a.data as Agreement[]) ?? []);
      setChanges((c.data as ChangeReq[]) ?? []);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  async function approve(id: string) {
    setBusy(id);
    try { await ClinicalAPI.approveContractChange(id); toast.success("Change approved"); refresh(); }
    catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  }
  async function apply(id: string) {
    setBusy(id);
    try { await ClinicalAPI.applyContractChange(id); toast.success("Change applied"); refresh(); }
    catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  }

  return (
    <div className="px-7 pt-6 pb-14 mx-auto space-y-4" style={{ maxWidth: 1240, width: "100%" }}>
      <DCard title="Payer agreements" caption="R1 · governed masters · view-only from HIS" icon={FileText}>
        {agreements.length === 0 ? (
          <div className="text-xs" style={{ color: "var(--clin-muted)" }}>
            No payer agreements yet. Create them from the Superadmin RCM masters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left mono text-[10px] uppercase tracking-widest border-b"
                  style={{ color: "var(--clin-muted)", borderColor: "var(--hairline)" }}>
                <th className="py-2 pr-3">Agreement</th>
                <th className="pr-3">Payer</th>
                <th className="pr-3">Effective</th>
                <th className="pr-3">Terms</th>
                <th className="pr-3">VAT</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td className="py-2 pr-3 mono text-[11px]">{a.agreement_no}</td>
                  <td className="pr-3 mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{a.payer_id.slice(0, 8)}</td>
                  <td className="pr-3 mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
                    {a.contract_start}{a.contract_end ? ` → ${a.contract_end}` : " → open"}
                  </td>
                  <td className="pr-3 mono text-[11px]">{a.settlement_terms_days ?? "—"} d</td>
                  <td className="pr-3 mono text-[10.5px]">{a.vat_treatment ?? "—"}</td>
                  <td className="py-2 text-right">
                    <span className="clin-pill" data-active={a.active ? "1" : "0"}>{a.active ? "active" : "inactive"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DCard>

      <DCard
        title="Contract change requests"
        caption="Governed diffs · approve → apply"
        icon={GitPullRequest}
        action={
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="clin-ctrl mono" style={{ height: 32, padding: "4px 8px", width: 140 }}>
              <option value="">All</option>
              <option value="draft">draft</option>
              <option value="approved">approved</option>
              <option value="applied">applied</option>
              <option value="rejected">rejected</option>
            </select>
            <button onClick={refresh} className="clin-ctrl mono flex items-center gap-1"
                    style={{ height: 32, padding: "4px 10px" }}>
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>
        }
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: "1.15fr 1fr" }}>
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left mono text-[10px] uppercase tracking-widest border-b"
                    style={{ color: "var(--clin-muted)", borderColor: "var(--hairline)" }}>
                  <th className="py-2 pr-3">Target</th>
                  <th className="pr-3">Status</th>
                  <th className="pr-3">Effective</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {changes.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-xs" style={{ color: "var(--clin-muted)" }}>No change requests.</td></tr>
                )}
                {changes.map((c) => {
                  const on = selected?.id === c.id;
                  return (
                    <tr key={c.id}
                        onClick={() => setSelected(c)}
                        style={{ borderTop: "1px solid var(--hairline)", background: on ? "var(--clin-teal-tint)" : undefined, cursor: "pointer" }}>
                      <td className="py-2 pr-3 mono text-[11px]">
                        {c.target_table} · {c.target_id.slice(0, 8)}
                      </td>
                      <td className="pr-3">
                        <span className="mono text-[10.5px] uppercase tracking-wider rounded-full px-2 py-0.5"
                              style={{ ...toneStyle(toneOfContractChange(c.status)), border: "1px solid var(--hairline)" }}>
                          {c.status}
                        </span>
                      </td>
                      <td className="pr-3 mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
                        {c.effective_date ?? "—"}
                      </td>
                      <td className="py-2 text-right space-x-1">
                        {c.status === "draft" && (
                          <CapGate role={role} cap="contract.change">
                            <button
                              onClick={(e) => { e.stopPropagation(); approve(c.id); }}
                              disabled={busy === c.id}
                              className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest disabled:opacity-40"
                              style={{ background: "var(--clin-warn-tint)", color: "var(--clin-warn)" }}>
                              Approve
                            </button>
                          </CapGate>
                        )}
                        {c.status === "approved" && (
                          <CapGate role={role} cap="contract.manage">
                            <button
                              onClick={(e) => { e.stopPropagation(); apply(c.id); }}
                              disabled={busy === c.id}
                              className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest text-white disabled:opacity-40"
                              style={{ background: "var(--teal)" }}>
                              Apply
                            </button>
                          </CapGate>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DiffPanel change={selected} />
        </div>
      </DCard>
    </div>
  );
}

function DiffPanel({ change }: { change: ChangeReq | null }) {
  const diff = useMemo(() => {
    if (!change) return [] as Array<{ key: string; before: unknown; after: unknown; changed: boolean }>;
    const keys = new Set<string>([
      ...Object.keys(change.before ?? {}),
      ...Object.keys(change.after ?? {}),
    ]);
    return Array.from(keys).map((k) => {
      const before = change.before?.[k];
      const after = change.after[k];
      return { key: k, before, after, changed: JSON.stringify(before) !== JSON.stringify(after) };
    });
  }, [change]);

  if (!change) {
    return (
      <div className="rounded-xl grid place-items-center text-[12px]"
           style={{ background: "var(--clin-sunken)", color: "var(--clin-muted)", minHeight: 220, border: "1px dashed var(--hairline)" }}>
        Select a change request to inspect the diff.
      </div>
    );
  }
  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4" style={{ color: "var(--clin-muted)" }} />
        <div className="mono text-[11px]" style={{ color: "var(--clin-ink)" }}>
          {change.target_table} · {change.target_id.slice(0, 8)}
        </div>
      </div>
      {change.reason && (
        <div className="text-[12px]" style={{ color: "var(--clin-text)" }}>
          <span className="mono uppercase text-[10px] tracking-widest mr-2" style={{ color: "var(--clin-faint)" }}>reason</span>
          {change.reason}
        </div>
      )}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--hairline)", background: "#fff" }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest"
                style={{ background: "var(--clin-raised)", color: "var(--clin-muted)" }}>
              <th className="py-1.5 px-2">Field</th>
              <th className="px-2">Before</th>
              <th className="px-2">After</th>
            </tr>
          </thead>
          <tbody>
            {diff.map((d) => (
              <tr key={d.key} style={{ borderTop: "1px solid var(--hairline)" }}>
                <td className="py-1 px-2 mono text-[11px]" style={{ color: "var(--clin-text)" }}>{d.key}</td>
                <td className="px-2 mono text-[11px]" style={{ color: d.changed ? "var(--clin-crit)" : "var(--clin-muted)" }}>
                  {fmt(d.before)}
                </td>
                <td className="px-2 mono text-[11px]" style={{ color: d.changed ? "var(--teal)" : "var(--clin-muted)" }}>
                  {fmt(d.after)}
                </td>
              </tr>
            ))}
            {diff.length === 0 && (
              <tr><td colSpan={3} className="py-2 px-2 text-[11px]" style={{ color: "var(--clin-muted)" }}>No field-level diff available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}