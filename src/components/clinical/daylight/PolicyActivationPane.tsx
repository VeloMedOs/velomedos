/**
 * R1 · Policy activation worklist.
 *
 * Reads /policy-activations and lets the approval officer:
 *  • Assign requests to themselves (single + bulk)
 *  • Patch policy_no / class_code / membership / validity
 *  • Activate (single + bulk) → visit_eligibility transitions to `insured`
 *  • Reject a request and either send to self-pay or re-queue eligibility
 *
 * HIS linkage: every action refreshes the linked visit_eligibility via
 * the shared applyEvent state machine on the server side.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, RefreshCw, Search, XCircle, UserCheck } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { useClinicalMe } from "@/lib/clinical-roles";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";
import { DCard } from "./Primitives";
import { CapGate } from "./CapGate";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Activation = {
  id: string;
  visit_eligibility_id: string;
  payer_id: string | null;
  policy_no: string | null;
  class_code: string | null;
  membership_no: string | null;
  is_ineligible_flag: boolean | null;
  validity_from: string | null;
  validity_to: string | null;
  status: "pending" | "in_progress" | "activated" | "rejected";
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
};

const STATUS_TONE: Record<Activation["status"], { bg: string; fg: string }> = {
  pending:     { bg: "var(--clin-warn-tint)", fg: "var(--clin-warn)" },
  in_progress: { bg: "var(--clin-teal-tint)", fg: "var(--teal)" },
  activated:   { bg: "var(--clin-ok-tint)",   fg: "var(--clin-ok)" },
  rejected:    { bg: "var(--clin-crit-tint)", fg: "var(--clin-crit)" },
};

export function PolicyActivationPane({ role }: { role: ClinicalRole | null }) {
  const { me } = useClinicalMe();
  const [rows, setRows] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Activation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const readOnly = !canPerform(role, "reg.activation");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ClinicalAPI.listPolicyActivations({
        status: statusFilter || undefined, limit: 200,
      });
      setRows((r.data as Activation[]) ?? []);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!s) return true;
      return [r.id, r.visit_eligibility_id, r.policy_no, r.membership_no, r.class_code]
        .filter(Boolean).join(" ").toLowerCase().includes(s);
    });
  }, [rows, search]);

  const allIds = filtered.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const toggleOne = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function runBulk(label: string, key: string, runOne: (r: Activation) => Promise<unknown>) {
    const target = filtered.filter((r) => selected.has(r.id));
    if (!target.length) return;
    setBulkBusy(key);
    const res = await Promise.allSettled(target.map(runOne));
    const ok = res.filter((x) => x.status === "fulfilled").length;
    const failed = res.length - ok;
    if (failed === 0) toast.success(`${label} · ${ok} updated`);
    else {
      const first = res.find((x) => x.status === "rejected") as PromiseRejectedResult | undefined;
      const msg = first?.reason instanceof ClinicalApiError ? first.reason.message : "See console";
      toast.error(`${label} · ${ok} ok · ${failed} failed — first: ${msg}`);
    }
    setSelected(new Set()); setBulkBusy(null); refresh();
  }

  async function activateOne(r: Activation) {
    setBusy(r.id);
    try { await ClinicalAPI.activatePolicy(r.id); toast.success("Policy activated"); refresh(); }
    catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  }
  async function assignToMe(r: Activation) {
    if (!me?.userId) return;
    setBusy(r.id);
    try {
      await ClinicalAPI.patchPolicyActivation(r.id, { assigned_to: me.userId, status: "in_progress" });
      toast.success("Assigned to you"); refresh();
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  }
  async function reject(r: Activation, reason: string) {
    setBusy(r.id);
    try {
      await ClinicalAPI.patchPolicyActivation(r.id, { status: "rejected", notes: reason });
      await ClinicalAPI.transitionEligibility(r.visit_eligibility_id, "activation.reject", reason);
      toast.success("Rejected · eligibility re-queued"); refresh();
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  }

  return (
    <div className="px-7 pt-6 pb-14 mx-auto space-y-4" style={{ maxWidth: 1240, width: "100%" }}>
      <DCard
        title="Policy activation"
        caption="R1 · approval officer worklist · activates locked-insurance visits"
        icon={BadgeCheck}
        status={readOnly ? <span className="clin-pill muted">View only</span> : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 clin-ctrl mono" style={{ height: 32, padding: "4px 8px", width: 200 }}>
              <Search className="size-3" style={{ color: "var(--clin-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                     placeholder="Search id / policy / membership"
                     className="bg-transparent outline-none w-full mono text-[11px]" />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="clin-ctrl mono" style={{ height: 32, padding: "4px 8px", width: 140 }}>
              <option value="">All</option>
              <option value="pending">pending</option>
              <option value="in_progress">in_progress</option>
              <option value="activated">activated</option>
              <option value="rejected">rejected</option>
            </select>
            <button onClick={refresh} className="clin-ctrl mono flex items-center gap-1"
                    style={{ height: 32, padding: "4px 10px" }}>
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>
        }
      >
        {!readOnly && selected.size > 0 && (
          <div className="sticky top-[60px] z-[8] flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
               style={{ background: "var(--clin-teal-tint)", border: "1px solid var(--teal)" }}>
            <span className="mono text-[11px] font-semibold" style={{ color: "var(--teal)" }}>
              {selected.size} selected
            </span>
            <div className="flex-1" />
            <BulkBtn onClick={() => runBulk("Assign to me", "assign", (r) =>
                     ClinicalAPI.patchPolicyActivation(r.id, { assigned_to: me?.userId, status: "in_progress" }))}
                     busy={bulkBusy === "assign"} label="Assign to me" />
            <BulkBtn onClick={() => runBulk("Activate", "activate", (r) => ClinicalAPI.activatePolicy(r.id))}
                     busy={bulkBusy === "activate"} label="Activate" tone="ok" />
            <BulkBtn onClick={() => runBulk("Reject", "reject", async (r) => {
                      await ClinicalAPI.patchPolicyActivation(r.id, { status: "rejected" });
                      return ClinicalAPI.transitionEligibility(r.visit_eligibility_id, "activation.reject", "Bulk reject");
                    })} busy={bulkBusy === "reject"} label="Reject" tone="crit" />
            <button onClick={() => setSelected(new Set())} className="p-1 rounded hover:bg-black/5">
              <XCircle className="size-4" style={{ color: "var(--clin-muted)" }} />
            </button>
          </div>
        )}

        <div className="grid gap-3" style={{ gridTemplateColumns: editing ? "1.3fr 1fr" : "1fr" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left mono text-[10px] uppercase tracking-widest border-b"
                  style={{ color: "var(--clin-muted)", borderColor: "var(--hairline)" }}>
                {!readOnly && (
                  <th className="py-2 pl-1 pr-2 w-6">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                  </th>
                )}
                <th className="py-2 pr-3">Request</th>
                <th className="pr-3">Eligibility</th>
                <th className="pr-3">Policy · class</th>
                <th className="pr-3">Membership</th>
                <th className="pr-3">Validity</th>
                <th className="pr-3">Status</th>
                <th className="pr-3">Assignee</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={readOnly ? 8 : 9} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>Loading…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={readOnly ? 8 : 9} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
                  No activation requests. When a coordinator requests activation from the eligibility worklist, rows land here.
                </td></tr>
              )}
              {filtered.map((r) => {
                const tone = STATUS_TONE[r.status];
                const isSel = selected.has(r.id);
                const canAct = r.status === "pending" || r.status === "in_progress";
                const mine = r.assigned_to && me?.userId && r.assigned_to === me.userId;
                return (
                  <tr key={r.id}
                      onClick={() => setEditing(r)}
                      style={{ borderTop: "1px solid var(--hairline)", cursor: "pointer",
                               background: editing?.id === r.id ? "var(--clin-teal-tint)" : isSel ? "color-mix(in oklab, var(--teal) 6%, transparent)" : undefined }}>
                    {!readOnly && (
                      <td className="py-2 pl-1 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(r.id)} />
                      </td>
                    )}
                    <td className="py-2 pr-3 mono text-[11px]">{r.id.slice(0, 8)}</td>
                    <td className="pr-3 mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{r.visit_eligibility_id.slice(0, 8)}</td>
                    <td className="pr-3 mono text-[11px]">{r.policy_no ?? "—"}{r.class_code ? ` · ${r.class_code}` : ""}</td>
                    <td className="pr-3 mono text-[11px]">{r.membership_no ?? "—"}</td>
                    <td className="pr-3 mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
                      {r.validity_from ?? "—"}{r.validity_to ? ` → ${r.validity_to}` : ""}
                    </td>
                    <td className="pr-3">
                      <span className="mono text-[10.5px] uppercase tracking-wider rounded-full px-2 py-0.5"
                            style={{ background: tone.bg, color: tone.fg, border: "1px solid var(--hairline)" }}>{r.status}</span>
                    </td>
                    <td className="pr-3 mono text-[10.5px]" style={{ color: mine ? "var(--teal)" : "var(--clin-muted)" }}>
                      {r.assigned_to ? (mine ? "you" : r.assigned_to.slice(0, 8)) : "—"}
                    </td>
                    <td className="py-2 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                      <CapGate role={role} cap="reg.activation">
                        {!r.assigned_to && (
                          <button onClick={() => assignToMe(r)} disabled={busy === r.id}
                                  className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest disabled:opacity-40"
                                  style={{ border: "1px solid var(--hairline)", color: "var(--clin-text)" }}>
                            <UserCheck className="size-3 inline" /> Take
                          </button>
                        )}
                        <button onClick={() => activateOne(r)} disabled={!canAct || busy === r.id}
                                className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest text-white disabled:opacity-40"
                                style={{ background: "var(--clin-ok)" }}>Activate</button>
                      </CapGate>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {editing && (
            <ActivationEditor
              key={editing.id}
              row={editing}
              readOnly={readOnly}
              onClose={() => setEditing(null)}
              onSaved={() => { setEditing(null); refresh(); }}
              onActivate={() => activateOne(editing)}
              onReject={(reason) => reject(editing, reason)}
            />
          )}
        </div>
      </DCard>
    </div>
  );
}

function ActivationEditor({
  row, readOnly, onClose, onSaved, onActivate, onReject,
}: {
  row: Activation; readOnly: boolean;
  onClose: () => void; onSaved: () => void;
  onActivate: () => void; onReject: (reason: string) => void;
}) {
  const [form, setForm] = useState({
    policy_no: row.policy_no ?? "",
    class_code: row.class_code ?? "",
    membership_no: row.membership_no ?? "",
    validity_from: row.validity_from ?? "",
    validity_to: row.validity_to ?? "",
    notes: row.notes ?? "",
  });
  const [rejReason, setRejReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await ClinicalAPI.patchPolicyActivation(row.id, {
        policy_no: form.policy_no || null,
        class_code: form.class_code || null,
        membership_no: form.membership_no || null,
        validity_from: form.validity_from || null,
        validity_to: form.validity_to || null,
        notes: form.notes || null,
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="mono uppercase text-[10px] tracking-widest" style={{ color: "var(--clin-faint)" }}>Activation detail</div>
          <div className="mono text-[11px]" style={{ color: "var(--clin-ink)" }}>{row.id.slice(0, 8)} · elig {row.visit_eligibility_id.slice(0, 8)}</div>
        </div>
        <button onClick={onClose} className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>Close</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Policy no">
          <input value={form.policy_no} onChange={(e) => setForm({ ...form, policy_no: e.target.value })} disabled={readOnly}
                 className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
        </Field>
        <Field label="Class code">
          <input value={form.class_code} onChange={(e) => setForm({ ...form, class_code: e.target.value })} disabled={readOnly}
                 className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
        </Field>
        <Field label="Membership no">
          <input value={form.membership_no} onChange={(e) => setForm({ ...form, membership_no: e.target.value })} disabled={readOnly}
                 className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
        </Field>
        <div />
        <Field label="Validity from">
          <input type="date" value={form.validity_from} onChange={(e) => setForm({ ...form, validity_from: e.target.value })} disabled={readOnly}
                 className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
        </Field>
        <Field label="Validity to">
          <input type="date" value={form.validity_to} onChange={(e) => setForm({ ...form, validity_to: e.target.value })} disabled={readOnly}
                 className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={readOnly}
                  className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
      </Field>

      {!readOnly && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy}
                    className="px-3 h-8 rounded mono text-[11px] uppercase tracking-widest text-white disabled:opacity-40"
                    style={{ background: "var(--teal)" }}>{busy ? "Saving…" : "Save patch"}</button>
            <button onClick={onActivate}
                    className="px-3 h-8 rounded mono text-[11px] uppercase tracking-widest text-white"
                    style={{ background: "var(--clin-ok)" }}>Activate</button>
            <div className="flex-1" />
          </div>
          <div className="rounded-lg p-2 space-y-2" style={{ background: "#fff", border: "1px solid var(--hairline)" }}>
            <div className="mono uppercase text-[10px] tracking-widest" style={{ color: "var(--clin-crit)" }}>Reject</div>
            <input placeholder="Reason (required)" value={rejReason} onChange={(e) => setRejReason(e.target.value)}
                   className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
            <button onClick={() => rejReason.trim() ? onReject(rejReason.trim()) : toast.error("Reason required")}
                    className="px-3 h-8 rounded mono text-[11px] uppercase tracking-widest text-white"
                    style={{ background: "var(--clin-crit)" }}>Reject · re-queue eligibility</button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="mono uppercase text-[10px] tracking-widest" style={{ color: "var(--clin-faint)" }}>{label}</span>
      {children}
    </label>
  );
}

function BulkBtn({ onClick, busy, label, tone }: { onClick: () => void; busy: boolean; label: string; tone?: "crit" | "ok" }) {
  const styleMap = tone === "crit"
    ? { bg: "var(--clin-crit-tint)", fg: "var(--clin-crit)" }
    : tone === "ok"
    ? { bg: "var(--clin-ok)",        fg: "#fff" }
    : { bg: "#fff",                  fg: "var(--clin-text)" };
  return (
    <button onClick={onClick} disabled={busy}
            className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest disabled:opacity-40"
            style={{ background: styleMap.bg, color: styleMap.fg, border: "1px solid var(--hairline)" }}>
      {busy ? "…" : label}
    </button>
  );
}