/**
 * R3 · Claims worklist (Daylight).
 *
 * Bucketed by {@link bucketOfClaim} with the Three-Second-Rule contract:
 *   Draft · Ready · Auth-hold · Coding-hold · Submitted · Rejected · Adjudicated · Closed.
 * Actions honour the state machine — nothing bypasses the server. Bulk actions
 * fan out through /api/clinical/v1/claims/bulk. Money is rendered via the
 * canonical `formatHalalas` (never bare `total_net_minor / 100`).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw, ShieldAlert, CheckCircle2, Sparkles, Send, XCircle, Search, ExternalLink,
  ListChecks, FileWarning, PlayCircle, RotateCcw,
} from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";
import { DCard } from "./Primitives";
import { CapGate } from "./CapGate";
import { toneOfClaim, toneStyle } from "@/lib/clinical/clinical-status";
import { bucketOfClaim, type ClaimBucket } from "@/lib/rcm/claim-sm";
import { formatHalalas } from "@/lib/clinical/format-money";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = {
  id: string;
  encounter_id: string | null;
  coverage_id: string | null;
  provider_claim_no: string | null;
  invoice_no: string | null;
  claim_type: string;
  claim_subtype: string | null;
  billing_model: string | null;
  status: string;
  total_net_minor: number;
  total_patient_share_minor: number;
  total_payer_share_minor: number;
  currency: string;
  submitted_at: string | null;
  adjudication_outcome: string | null;
  updated_at: string;
  locked_by: string | null;
  locked_at: string | null;
  bucket: ClaimBucket;
  encounter: { id: string; encounter_number?: string | null; class?: string | null; journey_state?: string | null } | null;
  visit_eligibility: { id: string; status: string } | null;
};

const BUCKET_META: Record<ClaimBucket, { label: string; caption: string; icon: any }> = {
  draft:        { label: "Draft",        caption: "Draft · assembled · scrubbing",  icon: ListChecks },
  scrub_failed: { label: "Scrub failed", caption: "Blockers must be cleared",       icon: FileWarning },
  auth_hold:    { label: "Auth hold",    caption: "Waiting on authorisation",        icon: ShieldAlert },
  coding_hold:  { label: "Coding hold",  caption: "Missing ICD-10-AM / DRG",         icon: FileWarning },
  ready:        { label: "Ready",        caption: "Priced · ready to submit",        icon: CheckCircle2 },
  submitted:    { label: "Submitted",    caption: "Awaiting payer response",         icon: Send },
  rejected:     { label: "Rejected",     caption: "Rejected · resubmit required",    icon: XCircle },
  adjudicated:  { label: "Adjudicated",  caption: "Remittance posted",               icon: Sparkles },
  closed:       { label: "Closed",       caption: "Terminal · voided or paid",       icon: XCircle },
};

const BUCKET_ORDER: ClaimBucket[] = [
  "draft", "scrub_failed", "auth_hold", "coding_hold",
  "ready", "submitted", "rejected", "adjudicated", "closed",
];

export function ClaimsWorklistPane({ role }: { role: ClinicalRole | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [bucketFilter, setBucketFilter] = useState<ClaimBucket | "">("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const readOnly = !canPerform(role, "claim.assemble");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ClinicalAPI.listClaimsWorklist({
        bucket: bucketFilter || undefined,
        q: search || undefined,
        limit: 200,
      });
      setRows((r.data as Row[]) ?? []);
      setCounts(r.counts ?? {});
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setLoading(false); }
  }, [bucketFilter, search]);

  useEffect(() => { refresh(); }, [refresh]);

  const totals = useMemo(() => {
    let net = 0, pat = 0, pay = 0;
    for (const r of rows) { net += r.total_net_minor; pat += r.total_patient_share_minor; pay += r.total_payer_share_minor; }
    return { net, pat, pay };
  }, [rows]);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const runBulk = async (action: "scrub" | "submit" | "assign_me" | "void") => {
    if (selected.size === 0) return toast.info("Select at least one claim");
    if (action === "void" && !confirm(`Void ${selected.size} claim(s)? This cannot be undone.`)) return;
    const reason = action === "void" ? (prompt("Reason (audit)?") ?? "") : undefined;
    if (action === "void" && (!reason || reason.length < 3)) return toast.error("Reason required");
    setBusy(`bulk:${action}`);
    try {
      const res = await ClinicalAPI.bulkClaims(action, Array.from(selected), reason);
      const failed = res.data.filter((r) => !r.ok);
      if (failed.length === 0) toast.success(`${action}: ${res.data.length} ok`);
      else toast.warning(`${action}: ${res.data.length - failed.length} ok · ${failed.length} failed`);
      setSelected(new Set());
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(null); }
  };

  const runOne = async (id: string, kind: "scrub" | "resubmit" | "void") => {
    setBusy(`${kind}:${id}`);
    try {
      if (kind === "scrub") {
        const r = await ClinicalAPI.scrubClaim(id);
        toast[r.data.ok ? "success" : "warning"](
          `Scrub → ${r.data.next_status} · ${r.data.blockers.length} blocker(s)`,
        );
      } else if (kind === "resubmit") {
        const reason = prompt("Resubmission reason?") ?? "";
        if (reason.length < 3) return;
        await ClinicalAPI.resubmitClaim(id, reason);
        toast.success("Resubmission draft created");
      } else {
        const reason = prompt("Void reason?") ?? "";
        if (reason.length < 3) return;
        await ClinicalAPI.voidClaim(id, reason);
        toast.success("Claim voided");
      }
      refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(null); }
  };

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1400, width: "100%" }}>
      <div className="grid gap-4">
        {/* Bucket tiles */}
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          <button
            onClick={() => setBucketFilter("")}
            className={`clin-pill ${bucketFilter === "" ? "" : "muted"}`}
            style={{ padding: "10px 12px", justifyContent: "flex-start" }}
          >
            <span className="mono text-[10px] uppercase tracking-widest">All</span>
            <span className="ml-auto mono text-[11px]">{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
          </button>
          {BUCKET_ORDER.map((b) => {
            const M = BUCKET_META[b]; const Icon = M.icon;
            const active = bucketFilter === b;
            return (
              <button key={b} onClick={() => setBucketFilter(active ? "" : b)}
                      className={`clin-pill ${active ? "" : "muted"}`}
                      title={M.caption}
                      style={{ padding: "10px 12px", justifyContent: "flex-start", gap: 6 }}>
                <Icon className="size-3.5" />
                <span className="text-[11px]">{M.label}</span>
                <span className="ml-auto mono text-[11px]">{counts[b] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <DCard
          title="Claims worklist"
          caption={`R3 · scrub · assemble · submit · ${rows.length} shown`}
          icon={ListChecks}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Claim # / invoice #"
                  className="clin-input pl-7 text-[12px]"
                  style={{ width: 220 }}
                />
              </div>
              <button onClick={refresh} className="clin-pill muted" disabled={loading}>
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="text-[11px]">Refresh</span>
              </button>
            </div>
          }
          status={
            <span className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>
              net {formatHalalas(totals.net)} · pat {formatHalalas(totals.pat)} · pay {formatHalalas(totals.pay)}
            </span>
          }
        >
          <CapGate role={role} cap="claim.assemble" mode="hide">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => runBulk("scrub")}   disabled={readOnly || busy?.startsWith("bulk")} className="clin-pill">
                <PlayCircle className="size-3.5" /><span className="text-[11px]">Scrub</span>
              </button>
              <button onClick={() => runBulk("submit")}  disabled={readOnly || busy?.startsWith("bulk")} className="clin-pill">
                <Send className="size-3.5" /><span className="text-[11px]">Submit</span>
              </button>
              <button onClick={() => runBulk("assign_me")} disabled={readOnly || busy?.startsWith("bulk")} className="clin-pill muted">
                <RotateCcw className="size-3.5" /><span className="text-[11px]">Assign me</span>
              </button>
              <button onClick={() => runBulk("void")}    disabled={readOnly || busy?.startsWith("bulk")} className="clin-pill muted">
                <XCircle className="size-3.5" /><span className="text-[11px]">Void</span>
              </button>
              <span className="mono text-[10px] ml-2" style={{ color: "var(--clin-muted)" }}>{selected.size} selected</span>
            </div>
          </CapGate>

          <div className="overflow-auto rounded-lg" style={{ border: "1px solid var(--clin-border)" }}>
            <table className="w-full text-[12.5px]">
              <thead className="mono text-[10px] uppercase tracking-widest"
                     style={{ background: "var(--clin-sunken)", color: "var(--clin-muted)" }}>
                <tr>
                  <th className="w-8 p-2 text-left">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="p-2 text-left">Claim</th>
                  <th className="p-2 text-left">Encounter</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-right">Net</th>
                  <th className="p-2 text-right">Patient</th>
                  <th className="p-2 text-right">Payer</th>
                  <th className="p-2 text-left">Updated</th>
                  <th className="p-2 text-right w-52">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr><td colSpan={10} className="p-6 text-center text-muted-foreground text-[12px]">No claims in this bucket.</td></tr>
                )}
                {rows.map((r) => {
                  const tone = toneOfClaim(r.status);
                  const canScrub = ["draft", "assembled", "scrub_failed", "auth_hold", "coding_hold", "priced", "ready"].includes(r.status);
                  const canResub = ["rejected", "resubmit_required"].includes(r.status);
                  const canVoid  = ["draft", "assembled", "scrub_failed", "ready", "auth_hold", "coding_hold"].includes(r.status);
                  return (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--clin-border)" }}>
                      <td className="p-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                      <td className="p-2">
                        <button onClick={() => setDetail(r)} className="mono text-[11px] underline underline-offset-2">
                          {r.provider_claim_no ?? r.id.slice(0, 8)}
                        </button>
                        {r.invoice_no && <div className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>{r.invoice_no}</div>}
                      </td>
                      <td className="p-2">
                        {r.encounter ? (
                          <a href={`/clinical?tab=encounters&encounter=${r.encounter.id}`}
                             className="mono text-[11px] underline underline-offset-2">
                            {r.encounter.encounter_number ?? r.encounter.id.slice(0, 8)}
                          </a>
                        ) : <span className="text-muted-foreground text-[11px]">—</span>}
                        {r.visit_eligibility && (
                          <div className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>
                            elg · {r.visit_eligibility.status}
                          </div>
                        )}
                      </td>
                      <td className="p-2 mono text-[11px]">
                        {r.claim_type}{r.claim_subtype ? ` · ${r.claim_subtype}` : ""}
                        {r.billing_model && <div style={{ color: "var(--clin-muted)" }}>{r.billing_model}</div>}
                      </td>
                      <td className="p-2">
                        <span className="clin-pill" style={toneStyle(tone)}>
                          <span className="text-[11px]">{r.status.replace(/_/g, " ")}</span>
                        </span>
                      </td>
                      <td className="p-2 text-right mono text-[11.5px]">{formatHalalas(r.total_net_minor, { currency: r.currency })}</td>
                      <td className="p-2 text-right mono text-[11.5px]">{formatHalalas(r.total_patient_share_minor, { currency: r.currency })}</td>
                      <td className="p-2 text-right mono text-[11.5px]">{formatHalalas(r.total_payer_share_minor, { currency: r.currency })}</td>
                      <td className="p-2 mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
                        {new Date(r.updated_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="p-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button title="Scrub" disabled={readOnly || !canScrub || busy === `scrub:${r.id}`}
                                  onClick={() => runOne(r.id, "scrub")} className="clin-pill muted" style={{ padding: "4px 8px" }}>
                            <PlayCircle className="size-3.5" />
                          </button>
                          <button title="Resubmit" disabled={readOnly || !canResub || busy === `resubmit:${r.id}`}
                                  onClick={() => runOne(r.id, "resubmit")} className="clin-pill muted" style={{ padding: "4px 8px" }}>
                            <RotateCcw className="size-3.5" />
                          </button>
                          <button title="Void" disabled={readOnly || !canVoid || busy === `void:${r.id}`}
                                  onClick={() => runOne(r.id, "void")} className="clin-pill muted" style={{ padding: "4px 8px" }}>
                            <XCircle className="size-3.5" />
                          </button>
                          <button title="Open" onClick={() => setDetail(r)} className="clin-pill muted" style={{ padding: "4px 8px" }}>
                            <ExternalLink className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DCard>
      </div>

      {detail && <ClaimDrawer row={detail} role={role} onClose={() => setDetail(null)} onChanged={refresh} />}
    </div>
  );
}

function ClaimDrawer({ row, role, onClose, onChanged }: { row: Row; role: ClinicalRole | null; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<"summary" | "scrub" | "lifecycle">("summary");
  const [lifecycle, setLifecycle] = useState<{ events: any[]; scrubs: any[]; submissions: any[] } | null>(null);
  const [scrub, setScrub] = useState<{ blockers: any[]; warnings: any[]; next_status: string; ok: boolean; hash: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const readOnly = !canPerform(role, "claim.assemble");

  useEffect(() => {
    (async () => {
      try {
        const r = await ClinicalAPI.claimLifecycle(row.id);
        setLifecycle(r.data);
      } catch { /* silent */ }
    })();
  }, [row.id]);

  const runScrub = async (dry = true) => {
    setBusy(true);
    try {
      const r = await ClinicalAPI.scrubClaim(row.id, dry);
      setScrub(r.data);
      setTab("scrub");
      if (!dry) { toast.success(`Scrub → ${r.data.next_status}`); onChanged(); }
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="absolute top-0 right-0 h-full w-full max-w-2xl overflow-auto"
           style={{ background: "var(--clin-canvas)", borderLeft: "1px solid var(--clin-border)" }}>
        <div className="p-5" style={{ borderBottom: "1px solid var(--clin-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>Claim</div>
              <div className="mono text-sm">{row.provider_claim_no ?? row.id}</div>
            </div>
            <button onClick={onClose} className="clin-pill muted"><span className="text-[11px]">Close</span></button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="clin-pill" style={toneStyle(toneOfClaim(row.status))}>
              <span className="text-[11px]">{row.status.replace(/_/g, " ")}</span>
            </span>
            <span className="mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
              net {formatHalalas(row.total_net_minor, { currency: row.currency })}
            </span>
          </div>
        </div>

        <div className="flex gap-1 px-5 pt-3" style={{ borderBottom: "1px solid var(--clin-border)" }}>
          {(["summary", "scrub", "lifecycle"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
                    className={`clin-pill ${tab === t ? "" : "muted"}`} style={{ padding: "6px 12px" }}>
              <span className="text-[11px] capitalize">{t}</span>
            </button>
          ))}
        </div>

        <div className="p-5 grid gap-3">
          {tab === "summary" && (
            <div className="grid gap-2 text-[12.5px]">
              <Field k="Encounter" v={row.encounter?.encounter_number ?? row.encounter_id ?? "—"} />
              <Field k="Coverage"  v={row.coverage_id ?? "—"} />
              <Field k="Type"      v={`${row.claim_type}${row.claim_subtype ? " · " + row.claim_subtype : ""}`} />
              <Field k="Model"     v={row.billing_model ?? "—"} />
              <Field k="Patient"   v={formatHalalas(row.total_patient_share_minor, { currency: row.currency })} />
              <Field k="Payer"     v={formatHalalas(row.total_payer_share_minor, { currency: row.currency })} />
              <div className="flex items-center gap-2 mt-2">
                <button disabled={readOnly || busy} onClick={() => runScrub(true)} className="clin-pill">
                  <PlayCircle className="size-3.5" /><span className="text-[11px]">Scrub (dry-run)</span>
                </button>
                <button disabled={readOnly || busy} onClick={() => runScrub(false)} className="clin-pill">
                  <PlayCircle className="size-3.5" /><span className="text-[11px]">Scrub & advance</span>
                </button>
              </div>
            </div>
          )}
          {tab === "scrub" && (
            <div className="grid gap-2 text-[12.5px]">
              {!scrub && <div className="text-muted-foreground text-[11px]">Run a scrub from the Summary tab.</div>}
              {scrub && (
                <>
                  <div className="mono text-[10.5px]" style={{ color: "var(--clin-muted)" }}>
                    next_status → <b>{scrub.next_status}</b> · hash {scrub.hash}
                  </div>
                  <FindingList title={`Blockers · ${scrub.blockers.length}`} items={scrub.blockers} severity="blocker" />
                  <FindingList title={`Warnings · ${scrub.warnings.length}`} items={scrub.warnings} severity="warning" />
                </>
              )}
            </div>
          )}
          {tab === "lifecycle" && (
            <div className="grid gap-2 text-[12px]">
              {!lifecycle && <div className="text-muted-foreground text-[11px]">Loading…</div>}
              {lifecycle && (
                <>
                  <Section title="State transitions">
                    {lifecycle.events.length === 0 && <Empty />}
                    {lifecycle.events.map((e) => (
                      <div key={e.id} className="flex items-baseline gap-2 mono text-[11px]">
                        <span style={{ color: "var(--clin-muted)" }}>{new Date(e.created_at).toLocaleString()}</span>
                        <span>{e.from_status ?? "∅"} → <b>{e.to_status}</b></span>
                        {e.reason && <span style={{ color: "var(--clin-muted)" }}>· {e.reason}</span>}
                      </div>
                    ))}
                  </Section>
                  <Section title="Scrub runs">
                    {lifecycle.scrubs.length === 0 && <Empty />}
                    {lifecycle.scrubs.map((s) => (
                      <div key={s.id} className="flex items-baseline gap-2 mono text-[11px]">
                        <span style={{ color: "var(--clin-muted)" }}>{new Date(s.run_at).toLocaleString()}</span>
                        <span>blockers {s.blocker_count} · warnings {s.warning_count}</span>
                        <span style={{ color: "var(--clin-muted)" }}>hash {s.hash}</span>
                      </div>
                    ))}
                  </Section>
                  <Section title="Submissions">
                    {lifecycle.submissions.length === 0 && <Empty />}
                    {lifecycle.submissions.map((a) => (
                      <div key={a.id} className="flex items-baseline gap-2 mono text-[11px]">
                        <span style={{ color: "var(--clin-muted)" }}>{new Date(a.started_at ?? a.created_at).toLocaleString()}</span>
                        <span>attempt {a.attempt_no} · {a.outcome}</span>
                        {a.http_status != null && <span style={{ color: "var(--clin-muted)" }}>HTTP {a.http_status}</span>}
                      </div>
                    ))}
                  </Section>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--clin-muted)", minWidth: 90 }}>{k}</span>
      <span className="mono text-[11.5px]">{v}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <div className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>{title}</div>
      <div className="grid gap-1">{children}</div>
    </div>
  );
}
function Empty() { return <div className="text-muted-foreground text-[11px]">— none —</div>; }

function FindingList({ title, items, severity }: { title: string; items: any[]; severity: "blocker" | "warning" }) {
  if (items.length === 0) return null;
  const tone = severity === "blocker" ? "coral" : "amber";
  return (
    <div className="grid gap-1">
      <div className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>{title}</div>
      <ul className="grid gap-1">
        {items.map((i, idx) => (
          <li key={idx} className="rounded-md p-2 text-[11.5px]"
              style={{ ...toneStyle(tone as any), borderColor: "var(--clin-border)" }}>
            <div className="mono text-[10px] uppercase tracking-widest opacity-80">{i.code} · {i.category}</div>
            <div>{i.message}</div>
            {i.fix_hint && <div className="opacity-80 mt-0.5">{i.fix_hint}</div>}
            {i.deep_link && (
              <a href={i.deep_link} className="underline underline-offset-2 mono text-[10.5px] mt-0.5 inline-block">Open →</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}