/**
 * Daylight · DoctorWorklistPane (Batch B spine · HCA-0174/0175/0186/0123).
 *
 * Reads `/api/clinical/v1/worklists/doctor?class=…` and renders the
 * per-encounter row set with counters, urgency/RCM filters, a Pending Orders
 * block, a Pre-Auth rail, and a fixed RCM Comm card. Class-parameterized via
 * the workspace `?class=` search param.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { worklistsApi, type DoctorWorklistRow, type RcmCommRow } from "@/lib/clinical-api";
import { ClinicalApiError } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { RcmCommCard, type RcmCommMessage } from "@/components/clinical/daylight/spine/RcmCommCard";
import { HimCommCard } from "@/components/clinical/daylight/spine/HimCommCard";
import {
  UrgencyChips, RcmStatusChips, formatWait, waitTone,
  type Urgency, type RcmStatus,
} from "./WorklistFilters";
import type { EncounterClass } from "./types";

function toCommMessage(r: RcmCommRow): RcmCommMessage {
  return {
    id: r.id,
    direction: r.direction,
    channel: r.status_pushed ?? r.kind,
    body: r.message,
    at: r.created_at,
    actor: r.author_role,
    kind: r.kind === "denial" ? "denial" : "authorization",
  };
}

export function DoctorWorklistPane() {
  const search = useSearch({ from: "/_authenticated/clinical" }) as { class?: string };
  const cls = search.class as EncounterClass | undefined;

  const [rows, setRows] = useState<DoctorWorklistRow[]>([]);
  const [comms, setComms] = useState<RcmCommRow[]>([]);
  const [urgency, setUrgency] = useState<Urgency>("all");
  const [rcm, setRcm] = useState<RcmStatus>("all");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [wl, cm] = await Promise.all([
          worklistsApi.doctor(cls ? { class: cls } : undefined),
          worklistsApi.rcmComms({ unread: true }),
        ]);
        if (cancel) return;
        setRows(wl.data ?? []);
        setComms(cm.data ?? []);
      } catch (e) {
        if (cancel) return;
        setErr(e instanceof ClinicalApiError ? e.message : "Failed to load worklist");
      }
    })();
    return () => { cancel = true; };
  }, [cls]);

  const counters = useMemo(() => {
    const total = rows.length;
    const billed = rows.reduce((a, r) => a + r.billed_orders, 0);
    const locked = rows.reduce((a, r) => a + r.locked_orders, 0);
    const released = rows.reduce((a, r) => a + r.released_orders, 0);
    const pendingRcm = rows.reduce((a, r) => a + r.pending_authorizations, 0);
    return { total, billed, locked, released, pendingRcm };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (rcm === "approved" && r.billed_orders === 0) return false;
      if (rcm === "further_details" && r.released_orders === 0) return false;
      if (rcm === "rejected" && r.locked_orders === 0) return false;
      if (rcm === "pending" && r.pending_authorizations === 0) return false;
      if (urgency === "stat" && (r.waiting_seconds ?? 0) < 60 * 60) return false;
      if (urgency === "urgent" && ((r.waiting_seconds ?? 0) < 30 * 60 || (r.waiting_seconds ?? 0) >= 60 * 60)) return false;
      if (urgency === "routine" && (r.waiting_seconds ?? 0) >= 30 * 60) return false;
      return true;
    });
  }, [rows, urgency, rcm]);

  return (
    <div
      className="px-7 pt-6 pb-14 mx-auto grid gap-4"
      style={{ maxWidth: 1400, width: "100%", gridTemplateColumns: "minmax(0,1fr) 320px" }}
    >
      <div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Counter label="Encounters" value={counters.total} />
          <Counter label="Billed"     value={counters.billed}    tone="ok" />
          <Counter label="Released"   value={counters.released}  tone="warn" />
          <Counter label="Locked"     value={counters.locked}    tone="crit" />
          <Counter label="Pre-auth"   value={counters.pendingRcm} tone="info" />
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <UrgencyChips value={urgency} onChange={setUrgency} />
          <RcmStatusChips value={rcm} onChange={setRcm} />
        </div>

        <DCard title="Assigned patients" caption="v_doctor_worklist · HCA-0174/0175/0186">
          {err ? <div className="clin-pill crit">{err}</div> : null}
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
              <tr>
                <th className="text-left py-2">Patient</th>
                <th className="text-left">Class</th>
                <th className="text-left">Waiting</th>
                <th className="text-left">Gate</th>
                <th className="text-left">Pre-auth</th>
                <th className="text-left">Physician</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.encounter_id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td className="py-2">
                    <div style={{ color: "var(--clin-ink)", fontWeight: 600 }}>
                      {r.name ?? "—"}{r.age != null && r.gender ? ` · ${r.age}${r.gender.charAt(0).toUpperCase()}` : ""}
                    </div>
                    <div className="mono text-[10px]" style={{ color: "var(--clin-muted)" }}>
                      MRN {r.mrn ?? "—"} · {r.encounter_number ?? r.encounter_id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="mono text-[11px]" style={{ color: "var(--clin-muted)" }}>{r.class}</td>
                  <td>
                    <span className={`clin-pill ${waitTone(r.waiting_seconds)}`}>{formatWait(r.waiting_seconds)}</span>
                  </td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {r.billed_orders > 0   && <span className="clin-pill ok">{r.billed_orders} billed</span>}
                      {r.released_orders > 0 && <span className="clin-pill warn">{r.released_orders} released</span>}
                      {r.locked_orders > 0   && <span className="clin-pill crit">{r.locked_orders} locked</span>}
                      {r.billed_orders + r.released_orders + r.locked_orders === 0
                        && <span className="clin-pill muted">—</span>}
                    </div>
                  </td>
                  <td>
                    {r.pending_authorizations > 0
                      ? <span className="clin-pill info">{r.pending_authorizations} pending</span>
                      : <span className="text-xs" style={{ color: "var(--clin-muted)" }}>—</span>}
                  </td>
                  <td className="text-xs" style={{ color: "var(--clin-muted)" }}>
                    {r.attending_physician ?? "unassigned"}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={6} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
                  No encounters match the current filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </DCard>

        <DCard title="Pending orders" caption="HCA-0123 · requested but not executed">
          <div className="text-xs" style={{ color: "var(--clin-muted)" }}>
            {rows.reduce((a, r) => a + r.locked_orders + r.released_orders, 0)} order(s) not yet performed across{" "}
            {rows.length} encounter(s). Open the encounter to work its Orders tab.
          </div>
        </DCard>
      </div>

      <aside className="space-y-3">
        <DCard title="Pre-Auth Requests" caption="/auth · pending decisioning">
          {rows.filter((r) => r.pending_authorizations > 0).slice(0, 8).map((r) => (
            <div key={r.encounter_id} className="flex items-center justify-between py-1.5 text-xs" style={{ borderBottom: "1px solid var(--hairline)" }}>
              <span>{r.name ?? r.encounter_id.slice(0, 8)}</span>
              <span className="clin-pill warn">{r.pending_authorizations} pending</span>
            </div>
          ))}
          {rows.every((r) => r.pending_authorizations === 0) && (
            <div className="text-xs" style={{ color: "var(--clin-muted)" }}>No pending pre-authorizations.</div>
          )}
        </DCard>
        <div>
          <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--clin-muted)" }}>
            RCM communications · unread ({comms.length})
          </div>
          <RcmCommCard messages={comms.slice(0, 6).map(toCommMessage)} />
        </div>
        <HimCommCard encounterId={filtered[0]?.encounter_id ?? null} />
      </aside>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "crit" | "info" }) {
  return (
    <div
      className="rounded-lg px-3 py-2 min-w-[90px]"
      style={{ background: "var(--clin-card, #fff)", border: "1px solid var(--hairline)" }}
    >
      <div className={`text-[18px] font-bold ${tone ? `clin-text-${tone}` : ""}`}
           style={{
             color: tone === "ok" ? "var(--clin-ok)"
                  : tone === "warn" ? "var(--clin-warn)"
                  : tone === "crit" ? "var(--clin-crit)"
                  : tone === "info" ? "var(--clin-info, #2563C9)"
                  : "var(--clin-ink)",
           }}>{value}</div>
      <div className="text-[10px] mono uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>{label}</div>
    </div>
  );
}