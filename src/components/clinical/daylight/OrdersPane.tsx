/**
 * Daylight · OrdersPane
 *
 * Lists charge_item rows for the most recent encounter of the signed-in
 * clinician's tenant. Each row wraps its Perform/Dispense action in
 * <BilledGate>; UI disable is UX-only — SQL trigger `charge_is_billed()`
 * is the enforcing gate.
 *
 * Worklist convention (locked for Step 2+): join `v_order_item_gate` for
 * every row and pass the server-side `gate_state` into <BilledGate>. Never
 * derive gate outcome client-side from `charge_item.status`.
 */
import { useEffect, useState } from "react";
import { ClinicalAPI, ClinicalApiError, gateApi, type GateViewRow } from "@/lib/clinical-api";
import { BilledGate } from "@/components/clinical/daylight/spine/BilledGate";
import { RcmCommCard } from "@/components/clinical/daylight/spine/RcmCommCard";
import type { BilledGateOutcome } from "@/lib/rcm/billed-gate";
import { DCard } from "@/components/clinical/daylight/Primitives";
import { formatHalalas } from "@/lib/clinical/format-money";

type ChargeRow = {
  id: string;
  encounter_id: string;
  order_item_table: string | null;
  order_item_id: string | null;
  description?: string | null;
  status: string;
  pricing_mode: string;
  urgency?: string | null;
  net_minor: number;
  currency: string;
};

/** Map v_order_item_gate.gate_state → BilledGateOutcome (canonical). */
function outcomeFromGate(row: ChargeRow, gate: GateViewRow | undefined): BilledGateOutcome {
  if (!gate) return { billed: false, reason: "unknown" };
  if (gate.gate_state === "billed") {
    return { billed: true, via: row.pricing_mode === "insured" ? "insured_auth" : "self_pay_cumulative" };
  }
  if (gate.gate_state === "released_by_exception") {
    return { billed: true, via: "release" };
  }
  const reason = (gate.reason_code ?? "unknown") as Extract<BilledGateOutcome, { billed: false }>["reason"];
  return { billed: false, reason };
}

function urgencyPill(u?: string | null) {
  const cls =
    u === "stat"   ? "clin-pill crit"
  : u === "urgent" ? "clin-pill warn"
  :                  "clin-pill muted";
  return <span className={cls}>{u ?? "routine"}</span>;
}

/** HCA-0250 · Billed Status pill (Paid / Unpaid). Presentation only. */
function billedStatusPill(row: ChargeRow, gate: GateViewRow | undefined) {
  const state = gate?.gate_state;
  const paid = state === "billed" || state === "released_by_exception";
  return (
    <span className={`clin-pill ${paid ? "ok" : "warn"}`} data-billed-status={paid ? "paid" : "unpaid"}>
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

export function OrdersPane() {
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [gate, setGate] = useState<Map<string, GateViewRow>>(new Map());
  const [encLabel, setEncLabel] = useState<string>("");
  const [status, setStatus] = useState<string>("all");
  const [urgency, setUrgency] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const encs = await ClinicalAPI.listEncounters();
        const first = (encs.data as Array<{ id: string; encounter_number?: string | null }>)[0];
        if (!first) { setEncLabel("No encounters"); return; }
        setEncLabel(first.encounter_number ?? first.id.slice(0, 8));
        const [r, g] = await Promise.all([
          ClinicalAPI.listCharges(first.id),
          gateApi.view(first.id),
        ]);
        setRows(((r.data as any)?.rows ?? r.data ?? []) as ChargeRow[]);
        const map = new Map<string, GateViewRow>();
        for (const row of g.data ?? []) map.set(row.charge_item_id, row);
        setGate(map);
      } catch (e) {
        setErr(e instanceof ClinicalApiError ? e.message : "Failed to load orders");
      }
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (urgency !== "all" && (r.urgency ?? "routine") !== urgency) return false;
    return true;
  });

  return (
    <div className="px-7 pt-6 pb-14 mx-auto grid gap-4" style={{ maxWidth: 1400, width: "100%", gridTemplateColumns: "minmax(0,1fr) 320px" }}>
      <div>
        <DCard title="Orders" caption={`Encounter · ${encLabel}`}>
          <div className="flex gap-2 mb-3 text-xs">
            <select className="clin-ctrl" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="ordered">Ordered</option>
              <option value="collected">Collected</option>
              <option value="in_progress">In progress</option>
              <option value="resulted">Resulted</option>
              <option value="dispensed">Dispensed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="clin-ctrl" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              <option value="all">All urgencies</option>
              <option value="stat">STAT</option>
              <option value="urgent">Urgent</option>
              <option value="routine">Routine</option>
            </select>
          </div>
          {err ? <div className="clin-pill crit">{err}</div> : null}
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wide" style={{ color: "var(--clin-muted)" }}>
              <tr>
                <th className="text-left py-2">Order</th>
                <th className="text-left">Urgency</th>
                <th className="text-left">Pricing</th>
                <th className="text-left">Billed Status</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td className="py-2">
                    <div style={{ color: "var(--clin-ink)" }}>{r.description ?? r.order_item_table ?? "Order"}</div>
                    <div className="text-[10px]" style={{ color: "var(--clin-muted)" }}>{r.status}</div>
                  </td>
                  <td>{urgencyPill(r.urgency)}</td>
                  <td className="text-xs" style={{ color: "var(--clin-muted)" }}>{r.pricing_mode}</td>
                  <td>{billedStatusPill(r, gate.get(r.id))}</td>
                  <td className="text-right mono text-xs">{formatHalalas(r.net_minor, { currency: r.currency })}</td>
                  <td className="text-right">
                    <BilledGate outcome={outcomeFromGate(r, gate.get(r.id))}>
                      <button className="clin-ctrl" style={{ padding: "4px 10px", width: "auto" }}>
                        {r.order_item_table === "prescription_item" ? "Dispense" : "Perform"}
                      </button>
                    </BilledGate>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={6} className="py-6 text-center text-xs" style={{ color: "var(--clin-muted)" }}>No orders match filters.</td></tr>
              )}
            </tbody>
          </table>
        </DCard>
      </div>
      <aside>
        <div className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--clin-muted)" }}>RCM comms</div>
        <RcmCommCard messages={[]} />
      </aside>
    </div>
  );
}