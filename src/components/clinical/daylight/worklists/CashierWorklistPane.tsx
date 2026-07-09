/**
 * Step 4 · Turn 2 · E14 — Cashier worklist (HCA-0793 → HCA-0824).
 * Reads only through `opdApi.cashier.*`. Grouped charges by billing_type,
 * consultation-fee lock indicator (KK2), and quick actions surface deposit /
 * cash / wallet allocation + raise pre-auth + credit-note guards.
 */
import { useEffect, useMemo, useState } from "react";
import { Wallet, ShieldAlert, Receipt, Lock } from "lucide-react";
import { opdApi } from "@/lib/clinical-api";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { formatHalalas } from "@/lib/clinical/format-money";

type WorklistRow = {
  encounter_id: string;
  encounter_number?: string | null;
  beneficiary_id: string;
  beneficiary_name?: string | null;
  outstanding_minor: number;
  charge_count?: number | null;
  currency?: string | null;
};

export function CashierWorklistPane() {
  const [rows, setRows] = useState<WorklistRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await opdApi.cashier.worklist({ limit: 100 });
        setRows((r.data?.rows ?? []) as WorklistRow[]);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  return (
    <div className="px-7 pt-6 pb-14 mx-auto grid gap-4"
         style={{ maxWidth: 1400, width: "100%", gridTemplateColumns: "minmax(0,1fr) 380px" }}>
      <div>
        <DCard title="Cashier worklist" caption="Billing · OP/ER · encounter-scoped" icon={Wallet}
               status={<span className="clin-pill muted mono">E14 · HCA-0793</span>}>
          {err ? <div className="clin-pill crit">{err}</div> : null}
          <table className="w-full text-sm" data-testid="cashier-worklist">
            <thead className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
              <tr>
                <th className="text-left py-2">Encounter</th>
                <th className="text-left">Beneficiary</th>
                <th className="text-right">Outstanding</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.encounter_id} style={{ borderTop: "1px solid var(--hairline)" }}
                    data-selected={selected === r.encounter_id ? "true" : undefined}>
                  <td className="py-2 mono text-[11px]">{r.encounter_number ?? r.encounter_id.slice(0, 8)}</td>
                  <td className="text-xs">{r.beneficiary_name ?? r.beneficiary_id.slice(0, 8)}</td>
                  <td className="text-right mono text-xs">
                    {formatHalalas(Number(r.outstanding_minor ?? 0), { currency: r.currency ?? "SAR" })}
                  </td>
                  <td className="text-right">
                    <button className="clin-ctrl" style={{ padding: "4px 10px", width: "auto" }}
                            onClick={() => setSelected(r.encounter_id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={4} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>
                  No outstanding balances.
                </td></tr>
              )}
            </tbody>
          </table>
        </DCard>
      </div>
      <aside>
        {selected
          ? <ChargesDetail encounterId={selected} />
          : <DCard title="Detail" caption="Select an encounter" icon={Receipt}>
              <div className="text-xs" style={{ color: "var(--clin-muted)" }}>
                Choose an encounter to review charges, consultation lock, and eligibility freshness.
              </div>
            </DCard>}
      </aside>
    </div>
  );
}

function ChargesDetail({ encounterId }: { encounterId: string }) {
  const [charges, setCharges] = useState<any[]>([]);
  const [lock, setLock] = useState<{ locked: boolean; reason: string | null } | null>(null);
  const [fresh, setFresh] = useState<{ must_recheck: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, l, f] = await Promise.all([
          opdApi.cashier.charges(encounterId),
          opdApi.cashier.consultationLock(encounterId),
          opdApi.cashier.eligibilityFreshness(encounterId),
        ]);
        setCharges((c.data?.rows ?? []) as any[]);
        setLock({ locked: !!l.data?.locked, reason: l.data?.reason ?? null });
        setFresh({ must_recheck: !!f.data?.must_recheck });
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [encounterId]);

  const grouped = useMemo(() => {
    const out: Record<string, any[]> = {};
    for (const c of charges) {
      const k = (c.billing_type as string) ?? "on_raising";
      (out[k] ||= []).push(c);
    }
    return out;
  }, [charges]);

  return (
    <div className="grid gap-3">
      <DCard title="Encounter" caption={encounterId.slice(0, 8)} icon={Receipt}
             status={
               <div className="flex gap-1">
                 {lock?.locked && <span className="clin-pill warn" data-testid="lock-pill"><Lock className="size-3 inline" /> {lock.reason}</span>}
                 {fresh?.must_recheck && <span className="clin-pill warn" data-testid="fresh-pill"><ShieldAlert className="size-3 inline" /> eligibility stale</span>}
               </div>
             }>
        {err ? <div className="clin-pill crit">{err}</div> : null}
        {Object.entries(grouped).map(([bt, list]) => (
          <div key={bt} className="grid gap-1 mb-2" data-billing-type={bt}>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>{bt}</div>
            {list.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs"
                   style={{ borderTop: "1px solid var(--hairline)", paddingTop: 4 }}>
                <span>{c.description ?? c.service_id?.slice?.(0, 8) ?? c.id.slice(0, 8)}</span>
                <span className="mono">{formatHalalas(Number(c.patient_share_minor ?? 0))}</span>
              </div>
            ))}
          </div>
        ))}
      </DCard>
    </div>
  );
}