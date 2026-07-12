/**
 * Step 5 · Turn 1 — Referral Cockpit (file 08 §C2, file 20 addendum).
 * Consumes the read-only cockpit route. No writes; per-row rule-engine
 * decision snapshot is surfaced as chips (preauth / charge mode / discount).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { referralCockpitApi, referralWritesApi, ClinicalApiError, type CockpitRow } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { FanOutDialog } from "./FanOutDialog";

const CLASSES = ["all", "intra", "inter_company", "external", "cross_encounter"] as const;

function Chip({ tone, children }: { tone: "info" | "warn" | "ok" | "muted"; children: React.ReactNode }) {
  return <span className={`clin-pill ${tone}`}>{children}</span>;
}

export function ReferralCockpitPane() {
  const [cls, setCls] = useState<(typeof CLASSES)[number]>("all");
  const [status, setStatus] = useState<string>("");
  const [fanOutRow, setFanOutRow] = useState<CockpitRow | null>(null);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["referral-cockpit", cls, status],
    queryFn: () => referralCockpitApi.cockpit({
      referral_class: cls === "all" ? undefined : cls,
      status: status || undefined,
      limit: 200,
    }),
  });

  const rows: CockpitRow[] = q.data?.data ?? [];

  const nutritionAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" }) =>
      referralWritesApi.acceptNutrition({ referral_id: id, action }),
    onSuccess: (_r, v) => {
      toast.success(`Nutrition referral ${v.action === "accept" ? "accepted" : "declined"}`);
      qc.invalidateQueries({ queryKey: ["referral-cockpit"] });
    },
    onError: (e) => { if (e instanceof ClinicalApiError) toast.error(e.message); else toast.error("Action failed"); },
  });
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
      <DCard title="Referral cockpit" caption="Outbound referrals with per-target rule-engine decision">
        <div className="flex flex-wrap items-center gap-3">
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

      <DCard title="Referrals">
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
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody data-testid="cockpit-rows">
              {q.isLoading && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No referrals.</td></tr>
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
                  <td className="px-3 py-2 text-xs">
                    <RowActions row={r} onFanOut={() => setFanOutRow(r)}
                      onNutrition={(action) => nutritionAction.mutate({ id: r.id, action })}
                      pending={nutritionAction.isPending} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DCard>
      {fanOutRow && <FanOutDialog row={fanOutRow} onClose={() => setFanOutRow(null)} />}
    </div>
  );
}

function RowActions({
  row, onFanOut, onNutrition, pending,
}: {
  row: CockpitRow;
  onFanOut: () => void;
  onNutrition: (a: "accept" | "decline") => void;
  pending: boolean;
}) {
  const isNutritionDraft = row.status === "draft"
    && typeof (row as any).source_key === "string"
    && ((row as any).source_key as string).startsWith("nutrition_screen:");
  return (
    <div className="flex flex-wrap gap-2">
      {row.status === "draft" && (
        <button className="text-xs underline" onClick={onFanOut} data-testid={`fan-out-btn-${row.id}`}>Fan out</button>
      )}
      {isNutritionDraft && (
        <>
          <button className="text-xs underline text-emerald-700 disabled:opacity-40"
            disabled={pending} onClick={() => onNutrition("accept")}
            data-testid={`nutrition-accept-${row.id}`}>Accept</button>
          <button className="text-xs underline text-rose-700 disabled:opacity-40"
            disabled={pending} onClick={() => onNutrition("decline")}
            data-testid={`nutrition-decline-${row.id}`}>Decline</button>
        </>
      )}
    </div>
  );
}