import { useEffect, useState } from "react";
import { opdApi } from "@/lib/clinical-api";
import { ClinicalApiError } from "@/lib/clinical-api";

/**
 * Step 4 · Turn 4 — Read-only maternity protocol sheet (D2 target).
 * Renders `maternity_protocol.rules` jsonb as a definition list.
 * Honest empty state when rules are empty per file 18.
 */
export function MaternityProtocolPanel({ encounterId }: { encounterId: string }) {
  const [data, setData] = useState<{ protocol_id: string | null; name: string | null; rules: Record<string, unknown> | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await opdApi.maternity.protocol(encounterId);
        if (alive) setData(r.data);
      } catch (e) {
        if (alive) setErr(e instanceof ClinicalApiError ? e.message : "load failed");
      }
    })();
    return () => { alive = false; };
  }, [encounterId]);

  if (err) return <div className="p-4 text-sm text-muted-foreground">No protocol resolved for this encounter.</div>;
  if (!data) return <div className="p-4 text-xs mono uppercase tracking-widest text-muted-foreground">Loading…</div>;

  const entries = data.rules ? Object.entries(data.rules) : [];
  return (
    <div className="clin-card p-4" data-testid="maternity-protocol-panel">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Maternity protocol</div>
      <h3 className="text-base font-semibold mt-1">{data.name ?? "—"}</h3>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Protocol rules pending — awaiting payer document. Cadence chip on the banner still applies.
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="mono text-[10px] uppercase tracking-widest text-muted-foreground self-center">{k}</dt>
              <dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}