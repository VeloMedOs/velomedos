/**
 * Step 4 · Turn 2 · E15 — Routing board (queue_occupancy load monitor).
 * Reads `opdApi.routing.board`. Load-band chips: low <40% / mid 40-75% /
 * high >75% of capacity. Cross-specialty route write goes through
 * `opdApi.routing.route` and is server-side specialty-locked.
 */
import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { opdApi } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";

type Row = {
  clinic_id: string;
  clinic_name?: string | null;
  clinic_specialties?: string[] | null;
  waiting_count?: number | null;
  in_consult_count?: number | null;
  capacity?: number | null;
  refreshed_at?: string | null;
};

function bandFor(pct: number): "low" | "mid" | "high" {
  if (pct < 0.4) return "low";
  if (pct < 0.75) return "mid";
  return "high";
}

export function RoutingBoardPane() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await opdApi.routing.board();
        setRows((r.data?.rows ?? []) as Row[]);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, []);

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1200, width: "100%" }}>
      <DCard title="Routing board" caption="Queue occupancy · load bands" icon={LayoutGrid}
             status={<span className="clin-pill muted mono">E15 · HCA-0946/0947</span>}>
        {err ? <div className="clin-pill crit">{err}</div> : null}
        <div className="grid gap-2" data-testid="routing-board" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {rows.map((r) => {
            const cap = Math.max(Number(r.capacity ?? 0), 1);
            const occ = Number(r.waiting_count ?? 0) + Number(r.in_consult_count ?? 0);
            const pct = Math.min(occ / cap, 2);
            const band = bandFor(pct);
            const pillCls = band === "high" ? "crit" : band === "mid" ? "warn" : "ok";
            return (
              <div key={r.clinic_id} className="p-3 rounded-lg" style={{ border: "1px solid var(--hairline)" }}
                   data-clinic-id={r.clinic_id} data-band={band}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm" style={{ color: "var(--clin-ink)" }}>{r.clinic_name ?? r.clinic_id.slice(0, 8)}</div>
                  <span className={`clin-pill ${pillCls} mono`}>{Math.round(pct * 100)}%</span>
                </div>
                <div className="text-[11px]" style={{ color: "var(--clin-muted)" }}>
                  waiting {r.waiting_count ?? 0} · in-consult {r.in_consult_count ?? 0} · cap {r.capacity ?? 0}
                </div>
                {r.clinic_specialties?.length ? (
                  <div className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
                    {r.clinic_specialties.join(" · ")}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!rows.length && (
            <div className="text-xs" style={{ color: "var(--clin-muted)" }}>No occupancy data.</div>
          )}
        </div>
      </DCard>
    </div>
  );
}