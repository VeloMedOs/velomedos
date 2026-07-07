/**
 * Daylight · RcmCommsInboxPane (Batch B spine §3).
 * Read-side inbox over `v_rcm_comm_thread`. Compose remains on the individual
 * auth/denial threads for Turn-1 (deep-link).
 */
import { useEffect, useMemo, useState } from "react";
import { worklistsApi, ClinicalApiError, type RcmCommRow } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";

type KindFilter = "all" | "authorization" | "denial" | "exception_escalation";

export function RcmCommsInboxPane() {
  const [rows, setRows] = useState<RcmCommRow[]>([]);
  const [kind, setKind] = useState<KindFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const r = await worklistsApi.rcmComms({
          kind: kind !== "all" ? kind : undefined,
          unread: unreadOnly || undefined,
        });
        if (!cancel) setRows(r.data ?? []);
      } catch (e) {
        if (!cancel) setErr(e instanceof ClinicalApiError ? e.message : "Failed to load");
      }
    })();
    return () => { cancel = true; };
  }, [kind, unreadOnly]);

  const counters = useMemo(() => ({
    total: rows.length,
    unread: rows.filter((r) => r.unread).length,
    escalations: rows.filter((r) => r.kind === "exception_escalation").length,
  }), [rows]);

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1100, width: "100%" }}>
      <div className="flex flex-wrap gap-2 mb-4">
        <Counter label="Messages"    value={counters.total} />
        <Counter label="Unread"      value={counters.unread}      tone="warn" />
        <Counter label="Escalations" value={counters.escalations} tone="crit" />
      </div>
      <div className="flex items-center gap-3 mb-3 text-xs">
        <span className="mono text-[10px] uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>Kind</span>
        {(["all","authorization","denial","exception_escalation"] as const).map((k) => {
          const on = k === kind;
          return (
            <button key={k} type="button" onClick={() => setKind(k)}
              className="px-2.5 h-6 rounded-full border"
              style={{
                borderColor: on ? "var(--teal)" : "var(--hairline)",
                background: on ? "var(--clin-teal-tint)" : "var(--clin-card, #fff)",
                color: on ? "var(--teal)" : "var(--clin-muted)",
                fontWeight: on ? 700 : 600,
              }}>{k.replace("_", " ")}</button>
          );
        })}
        <label className="flex items-center gap-1.5 ml-2" style={{ color: "var(--clin-muted)" }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
      </div>
      <DCard title="RCM Communication" caption="v_rcm_comm_thread · authorization + denial + emergency escalations">
        {err ? <div className="clin-pill crit">{err}</div> : null}
        <ol className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-md border px-3 py-2"
                style={{
                  borderColor: r.unread ? "var(--teal)" : "var(--hairline)",
                  background: r.kind === "exception_escalation" ? "var(--clin-crit-tint, #FBE7E5)"
                            : r.direction === "outbound" ? "var(--clin-info-tint)"
                            : "var(--clin-sunken)",
                }}>
              <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
                <span>
                  <span className={`clin-pill ${r.kind === "exception_escalation" ? "crit" : r.direction === "inbound" ? "info" : "muted"}`}>
                    {r.kind}
                  </span>
                  {" · "}{r.direction}{r.author_role ? ` · ${r.author_role}` : ""}
                </span>
                <time>{new Date(r.created_at).toLocaleString()}</time>
              </div>
              <div className="mt-1 text-sm" style={{ color: "var(--clin-ink)" }}>{r.message ?? "(empty)"}</div>
              {r.status_pushed ? (
                <div className="mt-1 mono text-[10px]" style={{ color: "var(--clin-muted)" }}>
                  status → {r.status_pushed}
                </div>
              ) : null}
            </li>
          ))}
          {!rows.length && (
            <li className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
              No messages match the filters.
            </li>
          )}
        </ol>
      </DCard>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "crit" }) {
  return (
    <div className="rounded-lg px-3 py-2 min-w-[90px]" style={{ background: "var(--clin-card, #fff)", border: "1px solid var(--hairline)" }}>
      <div className="text-[18px] font-bold" style={{
        color: tone === "ok" ? "var(--clin-ok)"
             : tone === "warn" ? "var(--clin-warn)"
             : tone === "crit" ? "var(--clin-crit)"
             : "var(--clin-ink)",
      }}>{value}</div>
      <div className="text-[10px] mono uppercase tracking-widest" style={{ color: "var(--clin-muted)" }}>{label}</div>
    </div>
  );
}