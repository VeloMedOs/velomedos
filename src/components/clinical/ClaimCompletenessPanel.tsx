import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Activity, Receipt } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";

type Completeness = Awaited<ReturnType<typeof ClinicalAPI.getClaimCompleteness>>;
type MissingItem = Completeness["missing"][number];

const STAGE_LABEL: Record<MissingItem["stage"], string> = {
  mds: "MDS · Clinical",
  drg: "DRG · Inpatient",
  rcm: "RCM · Billing",
};

const STAGE_ICON: Record<MissingItem["stage"], typeof Activity> = {
  mds: Activity,
  drg: ShieldCheck,
  rcm: Receipt,
};

export function ClaimCompletenessPanel({
  claimId,
  injectedMissing,
  onReadyClick,
  showReadyButton = true,
}: {
  claimId: string;
  injectedMissing?: MissingItem[] | null;
  onReadyClick?: () => void;
  showReadyButton?: boolean;
}) {
  const [data, setData] = useState<Completeness | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await ClinicalAPI.getClaimCompleteness(claimId);
      setData(r);
    } catch (e) {
      setErr(e instanceof ClinicalApiError ? e.message : "Failed to load completeness");
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { refresh(); }, [refresh]);

  const merged: MissingItem[] = injectedMissing && injectedMissing.length
    ? injectedMissing
    : data?.missing ?? [];

  const grouped = merged.reduce<Record<string, MissingItem[]>>((acc, m) => {
    (acc[m.stage] ||= []).push(m);
    return acc;
  }, {});

  const errCount = merged.filter((m) => m.severity === "error").length;
  const warnCount = merged.filter((m) => m.severity === "warning").length;
  const okOverall = (data?.ok ?? false) && errCount === 0;

  return (
    <div className="rounded-xl border border-hairline bg-panel">
      <div className="px-4 py-2.5 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-2">
          {okOverall ? (
            <CheckCircle2 className="size-4 text-stable" />
          ) : (
            <AlertTriangle className="size-4 text-caution" />
          )}
          <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Readiness · {okOverall ? "Complete" : `${errCount} blocker${errCount === 1 ? "" : "s"}${warnCount ? ` · ${warnCount} warning${warnCount === 1 ? "" : "s"}` : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest border border-hairline flex items-center gap-1"
          >
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} /> Re-check
          </button>
          {showReadyButton && onReadyClick && (
            <button
              onClick={onReadyClick}
              disabled={!okOverall}
              className="px-2 h-7 rounded mono text-[10px] uppercase tracking-widest bg-caution/20 text-caution disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Mark Ready
            </button>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {err && <div className="text-xs text-emergency">{err}</div>}
        {okOverall && !err && (
          <div className="text-xs text-stable">All MDS, DRG and RCM checks pass. Safe to mark ready.</div>
        )}
        {!okOverall && merged.length === 0 && !err && (
          <div className="text-xs text-muted-foreground">No issues to display.</div>
        )}
        {Object.entries(grouped).map(([stage, items]) => {
          const Icon = STAGE_ICON[stage as MissingItem["stage"]] ?? Activity;
          return (
            <div key={stage} className="rounded-lg border border-hairline bg-panel-elevated">
              <div className="px-3 py-2 border-b border-hairline flex items-center gap-2">
                <Icon className="size-3.5 text-action" />
                <span className="mono text-[10px] uppercase tracking-widest text-action">
                  {STAGE_LABEL[stage as MissingItem["stage"]] ?? stage}
                </span>
                <span className="mono text-[10px] text-muted-foreground">· {items.length}</span>
              </div>
              <ul className="px-3 py-2 space-y-1.5">
                {items.map((m, i) => (
                  <li key={`${m.code}-${i}`} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mono text-[9px] uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        m.severity === "error"
                          ? "bg-emergency/15 text-emergency"
                          : "bg-caution/15 text-caution"
                      }`}
                    >
                      {m.severity}
                    </span>
                    <div>
                      <div className="mono text-[10px] text-muted-foreground">{m.code}</div>
                      <div>{m.message}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-hairline">
            <Flag label="Eligibility" ok={data.rcm.eligibility_ok} />
            <Flag label="Executed-only" ok={data.rcm.executed_only_ok} />
            <Flag label="Snapshot locked" ok={data.rcm.snapshot_locked} />
            <Flag label="DRG" ok={!data.drg.required || (data.drg.present && data.drg.grouper_version_ok && data.drg.los_ok && data.drg.achi_ok)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Flag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${ok ? "border-stable/40 bg-stable/5" : "border-emergency/40 bg-emergency/5"}`}>
      <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mono text-[10px] ${ok ? "text-stable" : "text-emergency"}`}>{ok ? "PASS" : "FAIL"}</div>
    </div>
  );
}