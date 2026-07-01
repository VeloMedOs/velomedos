/**
 * R1 · Contract masters editor.
 *
 * Tabbed browser over payer_agreement + coverage-affecting masters:
 *   payers · payer-agreements · insurance-plans · insurance-classes ·
 *   networks · policies.
 *
 * All edits are governed: instead of a direct PATCH, the "Propose change"
 * button opens a diff editor that POSTs a contract_change_request. The
 * request then appears in ContractsPane where it can be approved & applied.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, RefreshCw, GitPullRequest, Search, X } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";
import { DCard } from "./Primitives";
import { CapGate } from "./CapGate";

/* eslint-disable @typescript-eslint/no-explicit-any */

type ResourceKey =
  | "payers"
  | "payer-agreements"
  | "insurance-plans"
  | "insurance-classes"
  | "networks"
  | "policies";

const RESOURCES: Array<{ key: ResourceKey; label: string; table: string; columns: string[] }> = [
  { key: "payers",            label: "Payers",             table: "payer",             columns: ["name_en", "name_ar", "code", "kind", "active"] },
  { key: "payer-agreements",  label: "Payer agreements",   table: "payer_agreement",   columns: ["agreement_no", "payer_id", "contract_start", "contract_end", "settlement_terms_days", "vat_treatment", "active"] },
  { key: "insurance-plans",   label: "Insurance plans",    table: "insurance_plan",    columns: ["name", "payer_id", "plan_type", "active"] },
  { key: "insurance-classes", label: "Insurance classes",  table: "insurance_class",   columns: ["code", "name", "payer_id", "coinsurance_pct", "copay_amount"] },
  { key: "networks",          label: "Networks",           table: "network",           columns: ["name", "payer_id", "active"] },
  { key: "policies",          label: "Policies",           table: "policy",            columns: ["policy_no", "payer_id", "insurance_class_id", "active"] },
];

export function ContractMastersPane({ role }: { role: ClinicalRole | null }) {
  const [tab, setTab] = useState<ResourceKey>("payer-agreements");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [proposing, setProposing] = useState<any | null>(null);
  const readOnly = !canPerform(role, "mast.contracts");
  const meta = RESOURCES.find((r) => r.key === tab)!;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ClinicalAPI.listMaster(tab);
      setRows((r.data as any[]) ?? []);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      Object.values(r).some((v) => typeof v === "string" && v.toLowerCase().includes(s)),
    );
  }, [rows, search]);

  return (
    <div className="px-7 pt-6 pb-14 mx-auto space-y-4" style={{ maxWidth: 1240, width: "100%" }}>
      <DCard
        title="Contract masters"
        caption="R1 · governed edits · propose → approve → apply"
        icon={FileText}
        status={readOnly ? <span className="clin-pill muted">View only</span> : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 clin-ctrl mono" style={{ height: 32, padding: "4px 8px", width: 200 }}>
              <Search className="size-3" style={{ color: "var(--clin-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rows…"
                     className="bg-transparent outline-none w-full mono text-[11px]" />
            </label>
            <button onClick={refresh} className="clin-ctrl mono flex items-center gap-1" style={{ height: 32, padding: "4px 10px" }}>
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-1 mb-3">
          {RESOURCES.map((r) => {
            const active = r.key === tab;
            return (
              <button key={r.key} onClick={() => { setTab(r.key); setProposing(null); }}
                      className="px-3 h-8 rounded-full mono text-[11px] uppercase tracking-widest"
                      style={{
                        background: active ? "var(--teal)" : "var(--clin-sunken)",
                        color: active ? "#fff" : "var(--clin-muted)",
                        border: `1px solid ${active ? "var(--teal)" : "var(--hairline)"}`,
                      }}>
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: proposing ? "1.4fr 1fr" : "1fr" }}>
          <div className="rounded-lg overflow-auto" style={{ border: "1px solid var(--hairline)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left mono text-[10px] uppercase tracking-widest"
                    style={{ color: "var(--clin-muted)", background: "var(--clin-raised)" }}>
                  {meta.columns.map((c) => <th key={c} className="py-2 px-2">{c}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={meta.columns.length + 1} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={meta.columns.length + 1} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>No rows.</td></tr>
                )}
                {filtered.map((row) => {
                  const on = proposing?.id === row.id;
                  return (
                    <tr key={row.id}
                        onClick={() => setProposing(row)}
                        style={{ borderTop: "1px solid var(--hairline)", cursor: "pointer",
                                 background: on ? "var(--clin-teal-tint)" : undefined }}>
                      {meta.columns.map((c) => (
                        <td key={c} className="py-2 px-2 mono text-[11px]" style={{ color: "var(--clin-text)" }}>
                          {renderCell(row[c])}
                        </td>
                      ))}
                      <td className="py-2 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <CapGate role={role} cap="mast.contracts">
                          <button onClick={() => setProposing(row)}
                                  className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest"
                                  style={{ border: "1px solid var(--hairline)", color: "var(--clin-text)" }}>
                            <GitPullRequest className="size-3 inline" /> Propose
                          </button>
                        </CapGate>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {proposing && (
            <ChangeProposal
              key={`${tab}:${proposing.id}`}
              tableName={meta.table}
              before={proposing}
              editableColumns={meta.columns}
              onClose={() => setProposing(null)}
              readOnly={readOnly}
            />
          )}
        </div>
      </DCard>
    </div>
  );
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  if (typeof v === "string" && v.length > 40) return v.slice(0, 40) + "…";
  return String(v);
}

function ChangeProposal({
  tableName, before, editableColumns, onClose, readOnly,
}: {
  tableName: string;
  before: any;
  editableColumns: string[];
  onClose: () => void;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = {};
    for (const c of editableColumns) seed[c] = before[c];
    return seed;
  });
  const [reason, setReason] = useState("");
  const [effective, setEffective] = useState("");
  const [busy, setBusy] = useState(false);

  const changed = useMemo(
    () => editableColumns.filter((c) => JSON.stringify(before[c]) !== JSON.stringify(draft[c])),
    [before, draft, editableColumns],
  );

  async function submit() {
    if (readOnly) return;
    if (changed.length === 0) { toast.error("No field changed."); return; }
    if (!reason.trim()) { toast.error("Reason is required for governance."); return; }
    setBusy(true);
    try {
      // Only send the editable columns as `after` — never the whole row.
      // Sending the full row would let apply overwrite id/tenant_id/created_at
      // with stale snapshot values and trip RLS WITH CHECK.
      const after = Object.fromEntries(
        editableColumns.map((c) => [c, draft[c]]),
      );
      await ClinicalAPI.createContractChangeRequest({
        target_table: tableName,
        target_id: before.id,
        before,
        after,
        reason: reason.trim(),
        effective_date: effective || null,
      });
      toast.success("Change request submitted for approval");
      onClose();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="mono uppercase text-[10px] tracking-widest" style={{ color: "var(--clin-faint)" }}>Propose change</div>
          <div className="mono text-[11px]" style={{ color: "var(--clin-ink)" }}>{tableName} · {String(before.id).slice(0, 8)}</div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-black/5"><X className="size-4" /></button>
      </div>

      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {editableColumns.map((c) => {
          const beforeVal = before[c];
          const isBool = typeof beforeVal === "boolean";
          const isNum = typeof beforeVal === "number";
          return (
            <label key={c} className="block">
              <span className="mono uppercase text-[10px] tracking-widest" style={{ color: "var(--clin-faint)" }}>{c}</span>
              {isBool ? (
                <select disabled={readOnly}
                        value={String(!!draft[c])}
                        onChange={(e) => setDraft({ ...draft, [c]: e.target.value === "true" })}
                        className="clin-ctrl w-full" style={{ padding: "6px 8px" }}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input type={isNum ? "number" : "text"}
                       disabled={readOnly}
                       value={draft[c] == null ? "" : String(draft[c])}
                       onChange={(e) => setDraft({ ...draft, [c]: isNum ? Number(e.target.value) : e.target.value })}
                       className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
              )}
              {changed.includes(c) && (
                <span className="mono text-[10px]" style={{ color: "var(--clin-warn)" }}>
                  was: {renderCell(beforeVal)}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <label className="block">
        <span className="mono uppercase text-[10px] tracking-widest" style={{ color: "var(--clin-faint)" }}>Effective date</span>
        <input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} disabled={readOnly}
               className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
      </label>
      <label className="block">
        <span className="mono uppercase text-[10px] tracking-widest" style={{ color: "var(--clin-faint)" }}>Reason *</span>
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} disabled={readOnly}
                  className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
      </label>

      <div className="flex items-center justify-between">
        <div className="mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
          {changed.length} field{changed.length === 1 ? "" : "s"} changed
        </div>
        <button onClick={submit} disabled={busy || readOnly}
                className="px-3 h-8 rounded mono text-[11px] uppercase tracking-widest text-white disabled:opacity-40"
                style={{ background: "var(--teal)" }}>
          {busy ? "Submitting…" : "Submit change request"}
        </button>
      </div>
    </div>
  );
}