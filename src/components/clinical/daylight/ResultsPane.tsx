/**
 * Daylight · ResultsPane
 *
 * Compact resulted-item list. Where result tables do not yet exist for a
 * given order type we show status only — never invent result rows.
 */
import { useEffect, useState } from "react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { RcmCommCard } from "@/components/clinical/daylight/spine/RcmCommCard";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { formatHalalas } from "@/lib/clinical/format-money";

type ChargeRow = {
  id: string;
  order_item_table: string | null;
  description?: string | null;
  status: string;
  net_minor: number;
  currency: string;
  updated_at?: string | null;
};

const RESULTED = new Set(["resulted", "completed", "dispensed"]);

export function ResultsPane() {
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [encLabel, setEncLabel] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const encs = await ClinicalAPI.listEncounters();
        const first = (encs.data as Array<{ id: string; encounter_number?: string | null }>)[0];
        if (!first) { setEncLabel("No encounters"); return; }
        setEncLabel(first.encounter_number ?? first.id.slice(0, 8));
        const r = await ClinicalAPI.listCharges(first.id);
        const list = (((r.data as any)?.rows ?? r.data ?? []) as ChargeRow[]).filter((c) => RESULTED.has(c.status));
        setRows(list);
      } catch (e) {
        setErr(e instanceof ClinicalApiError ? e.message : "Failed to load results");
      }
    })();
  }, []);

  return (
    <div className="px-7 pt-6 pb-14 mx-auto grid gap-4" style={{ maxWidth: 1400, width: "100%", gridTemplateColumns: "minmax(0,1fr) 320px" }}>
      <div>
        <DCard title="Results" caption={`Encounter · ${encLabel}`}>
          {err ? <div className="clin-pill crit">{err}</div> : null}
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="clin-card" style={{ padding: "10px 14px" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ color: "var(--clin-ink)" }}>{r.description ?? r.order_item_table ?? "Result"}</div>
                    <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>{r.status}</div>
                  </div>
                  <div className="mono text-xs">{formatHalalas(r.net_minor, { currency: r.currency })}</div>
                </div>
              </div>
            ))}
            {!rows.length && (
              <div className="text-xs" style={{ color: "var(--clin-muted)" }}>No resulted items yet.</div>
            )}
          </div>
        </DCard>
      </div>
      <aside>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--clin-muted)" }}>RCM comms</div>
        <RcmCommCard messages={[]} />
      </aside>
    </div>
  );
}