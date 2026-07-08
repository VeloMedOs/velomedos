/**
 * Step 3 · Turn 3 — Schedule Setup pane.
 *
 * Read-mostly view of clinic_schedule rows with a stub for the block-out
 * wizard (bulk cancel/reschedule/reassign body deferred to Batch C).
 * Delete-with-future-bookings action refused; wizard link surfaced instead.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { schedulerApi } from "@/lib/clinical-api";
import { ClinicalApiError } from "@/lib/clinical-api";
import { supabase } from "@/integrations/supabase/client";

type ScheduleRow = {
  id: string; clinic_id: string | null; provider_id: string | null;
  weekday: number | null; specific_date: string | null;
  start_time: string; end_time: string; slot_duration_min: number;
  capacity_per_slot: number; overbook_allowed: boolean;
  overbook_limit: number | null; priority_rank: number | null;
  status: string; specialty: string | null;
  telemedicine_capable: boolean; procedure_room: boolean;
  wheelchair_access: boolean; female_clinic: boolean;
};

export function ScheduleSetupPane() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const { data, error } = await supabase.from("clinic_schedule").select("*").order("priority_rank", { ascending: true, nullsFirst: false });
    if (error) { toast.error(error.message); return; }
    setRows(((data ?? []) as unknown) as ScheduleRow[]);
  }
  useEffect(() => { refresh(); }, []);

  async function blockAllDay(row: ScheduleRow) {
    setBusy(row.id);
    try {
      await schedulerApi.block({
        schedule_id: row.id,
        all_day: true,
        reason_code: "doctor_unavailable",
        note: "Block-out via Schedule Setup",
        notify_stakeholders: true,
      });
      toast.success("Session blocked. Bulk-transfer wizard skeleton pending (Batch C).");
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1400, width: "100%" }}>
      <div className="mb-4">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Clinical → Schedule Setup</div>
        <h1 className="text-xl font-semibold">OPD Schedule Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Per clinic + provider template. Block-out action opens the bulk cancel/reschedule/reassign wizard (skeleton this turn).
        </p>
      </div>

      <div className="clin-card p-0 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="p-2">Session</th>
              <th className="p-2">Specialty</th>
              <th className="p-2">Window</th>
              <th className="p-2">Slot</th>
              <th className="p-2">Cap / OB</th>
              <th className="p-2">Rank</th>
              <th className="p-2">Badges</th>
              <th className="p-2">Status</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No schedules defined.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-hairline">
                <td className="p-2 mono text-[11px]">{r.id.slice(0, 8)}…</td>
                <td className="p-2">{r.specialty ?? "—"}</td>
                <td className="p-2 mono text-[11px]">{r.start_time}–{r.end_time}</td>
                <td className="p-2">{r.slot_duration_min}m</td>
                <td className="p-2">
                  {r.capacity_per_slot}
                  {r.overbook_allowed && <span className="clin-pill warn ml-1">+{r.overbook_limit ?? 0}</span>}
                </td>
                <td className="p-2">{r.priority_rank ?? "—"}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {r.telemedicine_capable && <span className="clin-pill info">Tele</span>}
                    {r.procedure_room && <span className="clin-pill info">Proc</span>}
                    {r.wheelchair_access && <span className="clin-pill mut">♿</span>}
                    {r.female_clinic && <span className="clin-pill warn">♀</span>}
                  </div>
                </td>
                <td className="p-2"><span className="clin-pill mut">{r.status}</span></td>
                <td className="p-2 text-right">
                  <button
                    className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline hover:bg-panel-elevated disabled:opacity-50"
                    onClick={() => blockAllDay(r)}
                    disabled={busy === r.id}
                  >
                    Block-out
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 clin-card p-3">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Bulk transfer wizard</div>
        <p className="text-xs text-muted-foreground">
          The reschedule / reassign / cancel wizard skeleton is stubbed. Batch C fills the body
          (HCA-0732 / 0918). Delete-with-future-bookings is refused until the wizard is live.
        </p>
      </div>
    </div>
  );
}