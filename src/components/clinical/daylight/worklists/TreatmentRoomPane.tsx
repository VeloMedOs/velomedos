/**
 * Step 4 · Turn 3 — Treatment Room pane (E16 touch-point).
 *
 * Nursing workbench filtered to execution_venue='treatment_room'. Perform
 * action wrapped in <BilledGate>; UI disable is UX-only — SQL trigger
 * `order_item_perform_guard` remains the enforcer.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { opdApi } from "@/lib/clinical-api";
import { ClinicalApiError } from "@/lib/clinical-api";
import { BilledGate } from "@/components/clinical/daylight/spine/BilledGate";
import type { BilledGateOutcome } from "@/lib/rcm/billed-gate";

type Row = {
  order_item_table: string;
  order_item_id: string;
  charge_item_id: string;
  encounter_id: string;
  service_internal_code: string | null;
  service_name: string | null;
  gate_state: string;
  reason_code: string | null;
  net_minor: number | null;
  ordered_at: string | null;
  clinic_id: string | null;
};

function outcome(row: Row): BilledGateOutcome {
  if (row.gate_state === "billed" || row.gate_state === "released_by_exception") {
    return { billed: true };
  }
  return {
    billed: false,
    reason: (row.reason_code ?? "unknown") as Extract<BilledGateOutcome, { billed: false }>["reason"],
  };
}

export function TreatmentRoomPane() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [clinicFilter, setClinicFilter] = useState<string>("");

  async function refresh() {
    try {
      const r = await opdApi.treatmentRoom.worklist(clinicFilter ? { clinic_id: clinicFilter } : undefined);
      setRows((r.data.rows ?? []) as Row[]);
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clinicFilter]);

  async function perform(row: Row) {
    setBusy(row.order_item_id);
    try {
      await opdApi.treatmentRoom.perform({
        order_item_table: row.order_item_table,
        order_item_id: row.order_item_id,
      });
      toast.success("Order performed.");
      await refresh();
    } catch (e) {
      if (e instanceof ClinicalApiError) {
        if (e.code === "billed_gate") toast.error("Blocked by billed gate — cashier action required.");
        else toast.error(e.message);
      }
    } finally { setBusy(null); }
  }

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1400, width: "100%" }} data-testid="treatment-room-pane">
      <div className="mb-4">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Clinical → Treatment Room</div>
        <h1 className="text-xl font-semibold">Treatment Room worklist</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Services with execution venue "treatment_room". Perform requires the billed gate to clear.
        </p>
      </div>

      <div className="mb-3 flex gap-2 items-center">
        <label className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Clinic filter</label>
        <input
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          placeholder="clinic UUID (optional)"
          className="text-xs mono border border-hairline rounded px-2 py-1 w-[280px]"
        />
      </div>

      <div className="clin-card p-0 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="p-2">Order type</th>
              <th className="p-2">Service</th>
              <th className="p-2">Ordered</th>
              <th className="p-2">Gate</th>
              <th className="p-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No treatment-room orders.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.order_item_id} className="border-b border-hairline" data-testid="tr-row">
                <td className="p-2 mono text-[11px]">{r.order_item_table}</td>
                <td className="p-2">
                  <div className="text-sm">{r.service_name ?? "—"}</div>
                  <div className="mono text-[10px] text-muted-foreground">{r.service_internal_code ?? ""}</div>
                </td>
                <td className="p-2 mono text-[11px]">{r.ordered_at ? new Date(r.ordered_at).toLocaleString() : "—"}</td>
                <td className="p-2 mono text-[11px]">{r.gate_state}</td>
                <td className="p-2 text-right">
                  <BilledGate outcome={outcome(r)}>
                    <button
                      className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated disabled:opacity-50"
                      disabled={busy === r.order_item_id}
                      onClick={() => perform(r)}
                    >
                      Perform
                    </button>
                  </BilledGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}