/**
 * R4 · Admission & IP accounting worklist (Daylight).
 *
 * Real replacement for the `BillingIpPane` stub. Wires the R4 endpoints:
 *   - GET  /api/clinical/v1/ip/worklists         (bucketed rows + counts)
 *   - GET  /api/clinical/v1/ip/admission-requests/:id
 *   - POST /api/clinical/v1/ip/admission-requests/:id/action
 *   - POST /api/clinical/v1/ip/admission-requests/bulk
 *   - POST /api/clinical/v1/ip/daily-charges
 *
 * Three-Second-Rule: rows land in one of ten buckets driven by
 * {@link bucketOfAdmission}; the tiles above the table are the single source
 * of truth for load. Readiness blockers surface as inline chips + drawer
 * banner, so the case manager never advances a broken admission.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw, BedDouble, AlertTriangle, CheckCircle2, XCircle, Search,
  ClipboardCheck, ArrowRight, Ban, Send, DollarSign, PlayCircle, X,
} from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";
import { DCard, KV } from "./Primitives";
import {
  toneOfIpBucket, toneOfAdmissionStatus, toneStyle,
} from "@/lib/clinical/clinical-status";
import { formatHalalas } from "@/lib/clinical/format-money";
import {
  IP_BUCKET_LABEL, IP_BUCKET_ORDER, type AdmissionBucket,
} from "@/lib/rcm/ip-accounting-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = {
  id: string;
  admission_no: string | null;
  admission_serial: string | null;
  encounter_id: string | null;
  beneficiary_id: string | null;
  status: string;
  discharge_stage: string;
  room_type_entitled: string | null;
  requested_deposit_minor: number | null;
  paid_amount_minor: number | null;
  currency: string | null;
  bucket: AdmissionBucket;
  updated_at: string | null;
  created_at: string;
};

const TILE_ICON: Record<AdmissionBucket, any> = {
  requested:           AlertTriangle,
  lounge:              AlertTriangle,
  reception:           ClipboardCheck,
  in_house:            BedDouble,
  discharge_advice:    ArrowRight,
  discharge_order:     ArrowRight,
  medical_discharge:   ArrowRight,
  financial_discharge: DollarSign,
  discharged:          CheckCircle2,
  cancelled:           XCircle,
};

export function IpAdmissionsPane({ role }: { role: ClinicalRole | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [bucket, setBucket] = useState<AdmissionBucket | "">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [postingDaily, setPostingDaily] = useState(false);

  const readOnly = !canPerform(role, "bill.ip");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ClinicalAPI.listIpWorklist({ bucket: bucket || undefined, q: q || undefined, limit: 200 });
      setRows((r.data as Row[]) ?? []);
      setCounts(r.counts ?? {});
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setLoading(false); }
  }, [bucket, q]);

  useEffect(() => { refresh(); }, [refresh]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const doBulk = async (action: "assign_me" | "cancel" | "authorize" | "advance_lounge") => {
    if (readOnly || selected.size === 0) return;
    const ids = Array.from(selected);
    let reason: string | undefined;
    if (action === "cancel") {
      reason = window.prompt("Cancellation reason?") ?? undefined;
      if (!reason) return;
    }
    setBulkBusy(action);
    try {
      const r = await ClinicalAPI.bulkAdmissionRequests(action, ids, reason);
      const failed = r.data.filter((x) => !x.ok);
      if (failed.length) toast.warning(`${r.data.length - failed.length}/${r.data.length} succeeded`);
      else toast.success(`${r.data.length} admission(s) updated`);
      setSelected(new Set());
      await refresh();
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBulkBusy(null); }
  };

  const postDaily = async () => {
    if (readOnly) return;
    setPostingDaily(true);
    try {
      const r = await ClinicalAPI.runIpDailyCharges();
      const ok = r.data.results.filter((x) => x.ok).length;
      toast.success(`Posted daily charges for ${ok}/${r.data.results.length} admissions on ${r.data.run_date}`);
      await refresh();
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setPostingDaily(false); }
  };

  const tiles = useMemo(() => IP_BUCKET_ORDER.map((b) => ({
    id: b, label: IP_BUCKET_LABEL[b], count: counts[b] ?? 0, icon: TILE_ICON[b],
  })), [counts]);

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1400, width: "100%" }}>
      <DCard
        title="Admission & IP accounting"
        caption="R4 · lounge → reception → in-house → discharge"
        icon={BedDouble}
        status={
          <div className="flex items-center gap-2">
            {readOnly && <span className="clin-pill muted mono text-[11px]">View only</span>}
            <button
              className="clin-btn text-[12.5px]"
              onClick={postDaily}
              disabled={readOnly || postingDaily}
              title="Post today's room-board + nursing charges (idempotent)"
            >
              <PlayCircle size={13} style={{ marginRight: 4 }} />
              {postingDaily ? "Posting…" : "Post daily charges"}
            </button>
            <button className="clin-btn text-[12.5px]" onClick={refresh} disabled={loading}>
              <RefreshCw size={13} style={{ marginRight: 4 }} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        }
      >
        {/* Bucket tiles */}
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          <button
            key="all"
            onClick={() => setBucket("")}
            className="clin-tile"
            style={{ outline: bucket === "" ? "1px solid var(--clin-teal)" : undefined }}
          >
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>All</div>
            <div className="text-[20px] font-semibold" style={{ color: "var(--clin-text)" }}>
              {rows.length}
            </div>
          </button>
          {tiles.map((t) => {
            const Icon = t.icon;
            const active = bucket === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setBucket(t.id)}
                className="clin-tile"
                style={{ outline: active ? "1px solid var(--clin-teal)" : undefined }}
              >
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide"
                     style={{ color: "var(--clin-muted)" }}>
                  <Icon size={11} /> {t.label}
                </div>
                <div className="text-[20px] font-semibold" style={{ color: "var(--clin-text)" }}>{t.count}</div>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--clin-muted)" }} />
            <input
              className="clin-input pl-6 text-[12.5px]"
              style={{ width: 240 }}
              placeholder="Search admission #, serial…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px]" style={{ color: "var(--clin-muted)" }}>
              {selected.size} selected
            </span>
            <button className="clin-btn text-[12.5px]" disabled={readOnly || selected.size === 0 || !!bulkBusy}
                    onClick={() => doBulk("assign_me")}>
              {bulkBusy === "assign_me" ? "…" : "Assign to me"}
            </button>
            <button className="clin-btn text-[12.5px]" disabled={readOnly || selected.size === 0 || !!bulkBusy}
                    onClick={() => doBulk("authorize")} title="requested → authorized">
              <CheckCircle2 size={13} style={{ marginRight: 4 }} />
              {bulkBusy === "authorize" ? "…" : "Authorize"}
            </button>
            <button className="clin-btn text-[12.5px]" disabled={readOnly || selected.size === 0 || !!bulkBusy}
                    onClick={() => doBulk("advance_lounge")} title="authorized → lounge">
              <Send size={13} style={{ marginRight: 4 }} />
              {bulkBusy === "advance_lounge" ? "…" : "Advance to lounge"}
            </button>
            <button className="clin-btn text-[12.5px]" disabled={readOnly || selected.size === 0 || !!bulkBusy}
                    onClick={() => doBulk("cancel")}>
              <Ban size={13} style={{ marginRight: 4 }} />
              {bulkBusy === "cancel" ? "…" : "Cancel"}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="clin-table-wrap">
          <table className="clin-table text-[12.5px]">
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={rows.length === 0} />
                </th>
                <th>Admission #</th>
                <th>Bucket</th>
                <th>Status</th>
                <th>Room</th>
                <th>Deposit paid / requested</th>
                <th>Updated</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ color: "var(--clin-muted)", padding: "12px" }}>Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} style={{ color: "var(--clin-muted)", padding: "12px" }}>
                  No admissions in this bucket.
                </td></tr>
              )}
              {!loading && rows.map((r) => {
                const bTone = toneStyle(toneOfIpBucket(r.bucket));
                const sTone = toneStyle(toneOfAdmissionStatus(r.status));
                const cur = r.currency ?? "SAR";
                const paid = r.paid_amount_minor ?? 0;
                const req  = r.requested_deposit_minor ?? 0;
                const short = req > 0 && paid < req;
                return (
                  <tr key={r.id}>
                    <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                    <td className="mono">
                      {r.admission_no ?? <span style={{ color: "var(--clin-muted)" }}>—</span>}
                      {r.admission_serial && (
                        <div className="text-[11px]" style={{ color: "var(--clin-muted)" }}>{r.admission_serial}</div>
                      )}
                    </td>
                    <td><span className="clin-pill" style={bTone}>{IP_BUCKET_LABEL[r.bucket]}</span></td>
                    <td><span className="clin-pill" style={sTone}>{r.status}</span></td>
                    <td>{r.room_type_entitled ?? <span style={{ color: "var(--clin-muted)" }}>—</span>}</td>
                    <td>
                      <span style={{ color: short ? "var(--clin-warn)" : "var(--clin-text)" }}>
                        {formatHalalas(paid, { currency: cur })}
                      </span>
                      <span style={{ color: "var(--clin-muted)" }}> / {formatHalalas(req, { currency: cur })}</span>
                    </td>
                    <td style={{ color: "var(--clin-muted)" }}>
                      {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                    </td>
                    <td>
                      <button className="clin-btn text-[12px]" onClick={() => setOpenId(r.id)}>Open</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DCard>

      {openId && (
        <AdmissionDrawer
          id={openId}
          readOnly={readOnly}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

/* ─────────── Detail drawer ─────────── */
function AdmissionDrawer({
  id, readOnly, onClose, onChanged,
}: { id: string; readOnly: boolean; onClose: () => void; onChanged: () => void }) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ClinicalAPI.getAdmissionRequest(id);
      setPayload(r.data);
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const doAction = async (action: string, extra?: Record<string, unknown>) => {
    if (readOnly) return;
    setBusy(action);
    try {
      await ClinicalAPI.ipAdmissionAction(id, { action, ...(extra ?? {}) });
      toast.success(`Action "${action}" applied`);
      await load();
      onChanged();
    } catch (e) { if (e instanceof ClinicalApiError) toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.32)" }}
         onClick={onClose}>
      <div
        className="h-full overflow-y-auto"
        style={{ width: 620, background: "var(--clin-panel)", borderLeft: "1px solid var(--clin-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3"
             style={{ borderBottom: "1px solid var(--clin-border)" }}>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--clin-text)" }}>
              Admission {payload?.row?.admission_no ?? "(pending #)"}
            </div>
            <div className="text-[11px] mono" style={{ color: "var(--clin-muted)" }}>{id}</div>
          </div>
          <button className="clin-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {loading && <div className="p-4 text-[13px]" style={{ color: "var(--clin-muted)" }}>Loading…</div>}

        {!loading && payload && (
          <div className="p-4 grid gap-3">
            {/* Readiness banner */}
            {payload.readiness?.blockers?.length > 0 && (
              <div className="p-3 rounded" style={{
                background: payload.readiness.ok ? "var(--clin-warn-tint)" : "var(--clin-crit-tint)",
                color: payload.readiness.ok ? "var(--clin-warn)" : "var(--clin-crit)",
              }}>
                <div className="flex items-center gap-1 text-[12.5px] font-semibold">
                  <AlertTriangle size={13} />
                  {payload.readiness.ok ? "Warnings" : "Blocked"}
                </div>
                <ul className="mt-1 pl-4 list-disc text-[12px]">
                  {payload.readiness.blockers.map((b: any) => (
                    <li key={b.code}><span className="mono">{b.code}</span> — {b.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary */}
            <DCard title="Summary" caption="admission_request" icon={BedDouble}>
              <div className="grid grid-cols-2 gap-2">
                <KV k="Status" v={<span className="clin-pill" style={toneStyle(toneOfAdmissionStatus(payload.row.status))}>{payload.row.status}</span>} />
                <KV k="Bucket" v={<span className="clin-pill" style={toneStyle(toneOfIpBucket(payload.bucket))}>{IP_BUCKET_LABEL[payload.bucket as AdmissionBucket]}</span>} />
                <KV k="Room type" v={payload.row.room_type_entitled ?? "—"} />
                <KV k="Discharge stage" v={payload.row.discharge_stage ?? "none"} />
                <KV k="Deposit paid"
                    v={formatHalalas(payload.row.paid_amount_minor ?? 0, { currency: payload.row.currency ?? "SAR" })} />
                <KV k="Deposit requested"
                    v={formatHalalas(payload.row.requested_deposit_minor ?? 0, { currency: payload.row.currency ?? "SAR" })} />
              </div>
            </DCard>

            {/* Actions */}
            <DCard title="Actions" caption="lifecycle transitions" icon={ArrowRight}>
              <div className="flex flex-wrap gap-2">
                <button className="clin-btn text-[12.5px]" disabled={readOnly || !!busy}
                        onClick={() => doAction("authorize")}>
                  {busy === "authorize" ? "…" : "Authorize"}
                </button>
                <button className="clin-btn text-[12.5px]" disabled={readOnly || !!busy}
                        onClick={() => doAction("lounge_gate")}>
                  {busy === "lounge_gate" ? "…" : "Advance to lounge"}
                </button>
                <button className="clin-btn text-[12.5px]" disabled={readOnly || !!busy}
                        onClick={() => doAction("admit_reception")}>
                  {busy === "admit_reception" ? "…" : "Admit (reception)"}
                </button>
                <button className="clin-btn text-[12.5px]" disabled={readOnly || !!busy}
                        onClick={() => doAction("discharge_advance")}>
                  {busy === "discharge_advance" ? "…" : "Advance discharge"}
                </button>
                <button className="clin-btn text-[12.5px]" disabled={readOnly || !!busy}
                        onClick={() => {
                          const reason = window.prompt("Cancellation reason?");
                          if (reason) doAction("cancel", { reason });
                        }}>
                  {busy === "cancel" ? "…" : "Cancel"}
                </button>
              </div>
            </DCard>

            {/* Related lists */}
            <RelList title="Deposits" rows={payload.deposits ?? []}
                     render={(d: any) => `${d.status} · ${formatHalalas(d.amount_minor ?? 0, { currency: payload.row.currency ?? "SAR" })} · ${d.method}`} />
            <RelList title="Authorizations" rows={payload.authorizations ?? []}
                     render={(a: any) => `${a.status} · ${a.auth_type ?? "package"} · ${a.reference_no ?? a.id.slice(0, 8)}`} />
            <RelList title="Transfers" rows={payload.transfers ?? []}
                     render={(t: any) => `${t.from_room ?? "—"} → ${t.to_room ?? "—"} · ${new Date(t.transferred_at ?? t.created_at).toLocaleString()}`} />
            <RelList title="LOS extensions" rows={payload.los_extensions ?? []}
                     render={(l: any) => `+${l.additional_days}d · ${l.reason ?? ""} · ${l.status}`} />
          </div>
        )}
      </div>
    </div>
  );
}

function RelList({ title, rows, render }: { title: string; rows: any[]; render: (r: any) => string }) {
  return (
    <DCard title={title} caption={`${rows.length} row(s)`} icon={ClipboardCheck}>
      {rows.length === 0
        ? <div className="text-[12.5px]" style={{ color: "var(--clin-muted)" }}>None</div>
        : <ul className="text-[12.5px] pl-4 list-disc space-y-1" style={{ color: "var(--clin-text)" }}>
            {rows.map((r) => <li key={r.id}>{render(r)}</li>)}
          </ul>}
    </DCard>
  );
}