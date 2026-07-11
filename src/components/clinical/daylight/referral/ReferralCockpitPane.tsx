/**
 * Step 5 · Turn 1 — Referral Cockpit (file 08 §C2, file 20 addendum).
 * Consumes the read-only cockpit route. No writes; per-row rule-engine
 * decision snapshot is surfaced as chips (preauth / charge mode / discount).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { referralCockpitApi, type CockpitRow } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";

const CLASSES = ["all", "intra", "inter_company", "external", "cross_encounter"] as const;

function Chip({ tone, children }: { tone: "info" | "warn" | "ok" | "muted"; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    info: "bg-sky-100 text-sky-900 border-sky-200",
    warn: "bg-amber-100 text-amber-900 border-amber-200",
    ok:   "bg-emerald-100 text-emerald-900 border-emerald-200",
    muted:"bg-slate-100 text-slate-700 border-slate-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${cls[tone]}`}>{children}</span>;
}

export function ReferralCockpitPane() {
  const [cls, setCls] = useState<(typeof CLASSES)[number]>("all");
  const [status, setStatus] = useState<string>("");
  const q = useQuery({
    queryKey: ["referral-cockpit", cls, status],
    queryFn: () => referralCockpitApi.cockpit({
      referral_class: cls === "all" ? undefined : cls,
      status: status || undefined,
      limit: 200,
    }),
  });

  const rows: CockpitRow[] = q.data?.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { total: rows.length, auto: 0, preauth: 0, blocked: 0 };
    for (const r of rows) {
      if (r.auto_generated) c.auto++;
      if (r.rule_decision?.preauth_required) c.preauth++;
      if (r.rule_decision?.block_reason) c.blocked++;
    }
    return c;
  }, [rows]);

  return (
    <div className="space-y-3" data-testid="referral-cockpit">
      <DCard>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="text-sm font-semibold">Referral cockpit</div>
          <div className="flex gap-2 text-xs">
            <Chip tone="muted">Total {counts.total}</Chip>
            <Chip tone="info">Auto-generated {counts.auto}</Chip>
            <Chip tone="warn">Pre-auth {counts.preauth}</Chip>
            <Chip tone="warn">Blocked {counts.blocked}</Chip>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <label>Class</label>
            <select value={cls} onChange={(e) => setCls(e.target.value as any)} className="border rounded px-2 py-1">
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label>Status</label>
            <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="draft/pending/…" className="border rounded px-2 py-1" />
          </div>
        </div>
      </DCard>

      <DCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 border-b">
              <tr>
                <th className="px-3 py-2">Ref #</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">Targets</th>
                <th className="px-3 py-2">Rule decision</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody data-testid="cockpit-rows">
              {q.isLoading && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No referrals.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-slate-50" data-referral-id={r.id}>
                  <td className="px-3 py-2 font-mono text-xs">{r.referral_no}</td>
                  <td className="px-3 py-2">{r.referral_class}</td>
                  <td className="px-3 py-2">{r.source_specialty ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.targets.map((t) => (
                        <Chip key={t.id} tone="muted">{t.target_kind}{t.target_specialty ? `·${t.target_specialty}` : ""}</Chip>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.rule_decision?.preauth_required && <Chip tone="warn">pre-auth</Chip>}
                      {r.rule_decision?.charge_mode && <Chip tone="info">{r.rule_decision.charge_mode}</Chip>}
                      {typeof r.rule_decision?.discount_pct === "number" && r.rule_decision.discount_pct > 0 && (
                        <Chip tone="ok">{r.rule_decision.discount_pct}% off</Chip>
                      )}
                      {r.rule_decision?.block_reason && <Chip tone="warn">blocked: {r.rule_decision.block_reason}</Chip>}
                      {!r.rule_decision || Object.keys(r.rule_decision).length === 0 ? <Chip tone="muted">—</Chip> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DCard>
    </div>
  );
}