import { useEffect, useState } from "react";
import { opdApi } from "@/lib/clinical-api";

/**
 * Step 4 · Turn 4 — D4 cross-facility visits (view-only stub).
 * File 18 explicit: no cross-tenant write surface. Lists prior encounters
 * that share the pregnancy episode within THIS tenant only.
 */
export function CrossFacilityVisitsSheet({ encounterId }: { encounterId: string }) {
  const [rows, setRows] = useState<Array<{ encounter_id: string; period_start: string | null; facility: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await opdApi.maternity.banner(encounterId);
        if (alive) setRows(r.data.cross_facility_visits ?? []);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [encounterId]);

  return (
    <div className="clin-card p-4" data-testid="cross-facility-sheet">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Cross-facility visits (view only)</div>
      {loading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No sibling encounters within this tenant. Cross-tenant view is deferred.</p>
      ) : (
        <ul className="mt-2 divide-y divide-hairline text-sm">
          {rows.map((r) => (
            <li key={r.encounter_id} className="py-1.5 flex justify-between">
              <span className="mono text-[11px]">{r.encounter_id.slice(0, 8)}…</span>
              <span className="text-muted-foreground">{r.period_start ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}