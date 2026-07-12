/**
 * Step 5 · Turn 3 — Referral report pane (HCA-1010).
 *
 * Reads `/api/clinical/v1/opd/referral/report`; exports CSV via anchor to
 * `/api/clinical/v1/opd/referral/report.csv` with the same filters.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { referralCockpitApi, type ReportFilters } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CLUSTER_OPTS: Array<ReportFilters["cluster_scope"]> = ["all", "own", "sibling", "external"];
const TARGET_KINDS = ["", "specialty", "encounter", "entity", "external_facility"];

function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtHours(n: number | null) { return n == null ? "—" : `${n.toFixed(1)}h`; }

function KpiCard({ label, value, tone }: { label: string; value: string; tone?: "info" | "warn" | "ok" }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--clin-raised)", border: "1px solid var(--hairline)" }}
    >
      <div className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: tone === "warn" ? "var(--coral, #FF6E5B)" : "var(--clin-text)" }}>{value}</div>
    </div>
  );
}

export function ReferralReportPane() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0, 10));
  const [sourceSpecialty, setSourceSpecialty] = useState("");
  const [targetKind, setTargetKind] = useState("");
  const [clusterScope, setClusterScope] = useState<ReportFilters["cluster_scope"]>("all");

  const filters: ReportFilters = useMemo(() => ({
    date_from: new Date(dateFrom).toISOString(),
    date_to: new Date(dateTo + "T23:59:59.999Z").toISOString(),
    source_specialty: sourceSpecialty || undefined,
    target_kind: targetKind || undefined,
    cluster_scope: clusterScope,
  }), [dateFrom, dateTo, sourceSpecialty, targetKind, clusterScope]);

  const q = useQuery({
    queryKey: ["referral-report", filters],
    queryFn: () => referralCockpitApi.report(filters),
  });
  const d = q.data?.data;

  const csvHref = referralCockpitApi.reportCsvUrl(filters);

  return (
    <div className="space-y-3" data-testid="referral-report">
      <DCard title="Referral report (HCA-1010)" caption="Volumes · acceptance · TAT · decline reasons">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span>Date from</span>
            <input type="date" className="clin-ctrl" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="report-date-from" />
          </label>
          <label className="flex flex-col gap-1">
            <span>Date to</span>
            <input type="date" className="clin-ctrl" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="report-date-to" />
          </label>
          <label className="flex flex-col gap-1">
            <span>Source specialty</span>
            <input className="clin-ctrl" value={sourceSpecialty} onChange={(e) => setSourceSpecialty(e.target.value)} placeholder="e.g. gp" />
          </label>
          <label className="flex flex-col gap-1">
            <span>Target kind</span>
            <select className="clin-ctrl" value={targetKind} onChange={(e) => setTargetKind(e.target.value)}>
              {TARGET_KINDS.map((k) => <option key={k} value={k}>{k || "(any)"}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>Cluster scope</span>
            <select className="clin-ctrl" value={clusterScope} onChange={(e) => setClusterScope(e.target.value as ReportFilters["cluster_scope"])}>
              {CLUSTER_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {d?.truncated && <span className="clin-pill warn" data-testid="report-truncated">Truncated · 5000 row cap</span>}
          <a
            href={csvHref}
            download
            className="ml-auto px-3 py-1 rounded bg-slate-900 text-white text-xs no-underline"
            data-testid="report-csv-export"
          >
            Export CSV
          </a>
        </div>
      </DCard>

      {q.isLoading && <DCard title="Loading…"><div className="text-xs text-slate-500">Fetching report…</div></DCard>}

      {d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Referrals" value={String(d.totals.referrals)} />
            <KpiCard label="Rows (targets)" value={String(d.totals.rows)} />
            <KpiCard label="Acceptance rate" value={fmtPct(d.acceptance_rate)} tone="ok" />
            <KpiCard label="Mean TAT" value={fmtHours(d.tat.mean_hours)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DCard title="By source specialty">
              <table className="w-full text-sm" data-testid="report-by-source">
                <thead className="text-left text-xs text-slate-500 border-b">
                  <tr><th className="px-3 py-2">Specialty</th><th className="px-3 py-2">Count</th></tr>
                </thead>
                <tbody>
                  {d.by_source.length === 0 && <tr><td colSpan={2} className="px-3 py-4 text-center text-slate-500">No data</td></tr>}
                  {d.by_source.map((r) => (
                    <tr key={r.source_specialty} className="border-b">
                      <td className="px-3 py-2">{r.source_specialty}</td>
                      <td className="px-3 py-2 font-mono">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DCard>
            <DCard title="By target">
              <table className="w-full text-sm" data-testid="report-by-target">
                <thead className="text-left text-xs text-slate-500 border-b">
                  <tr><th className="px-3 py-2">Kind</th><th className="px-3 py-2">Specialty</th><th className="px-3 py-2">Count</th></tr>
                </thead>
                <tbody>
                  {d.by_target.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">No data</td></tr>}
                  {d.by_target.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">{r.target_kind}</td>
                      <td className="px-3 py-2">{r.target_specialty ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DCard>
          </div>

          <DCard title="Decline reasons" caption="Sorted by frequency (target status = declined)">
            <div className="space-y-2" data-testid="report-decline-reasons">
              {d.decline_reasons.length === 0 && <div className="text-xs text-slate-500">No declined targets in range.</div>}
              {d.decline_reasons.map((r, i) => {
                const max = d.decline_reasons[0].count;
                const pct = max > 0 ? (r.count / max) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-40 truncate" title={r.reason}>{r.reason}</div>
                    <div className="flex-1 h-3 rounded" style={{ background: "var(--clin-raised)", border: "1px solid var(--hairline)" }}>
                      <div className="h-full rounded" style={{ width: `${pct}%`, background: "var(--teal)" }} />
                    </div>
                    <div className="w-10 text-right font-mono">{r.count}</div>
                  </div>
                );
              })}
            </div>
          </DCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DCard title="Cluster split">
              <div className="flex flex-wrap gap-2 text-xs" data-testid="report-cluster">
                <span className="clin-pill info">own {d.cluster_split.own}</span>
                <span className="clin-pill muted">sibling {d.cluster_split.sibling}</span>
                <span className="clin-pill warn">external {d.cluster_split.external}</span>
                <span className="clin-pill muted">external blocked share {fmtPct(d.external_blocked_share)}</span>
              </div>
            </DCard>
            <DCard title="Series vs single">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="clin-pill info">series {d.series_split.series}</span>
                <span className="clin-pill muted">single {d.series_split.single}</span>
              </div>
            </DCard>
          </div>
        </>
      )}
    </div>
  );
}