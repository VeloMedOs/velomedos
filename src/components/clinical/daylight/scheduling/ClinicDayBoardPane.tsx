/**
 * Step 3 · Turn 3 — Clinic Day Board pane (Batch C_10).
 *
 * Consumes the generic <DayBoard /> with an OPD SuiteConfig. Reads ?day=
 * and ?clinic_id= from search params. Renders:
 *   - the day board (columns = sessions, rows = time)
 *   - a booking-request rail on the right
 *   - a walk-in / urgent lane (top of rail, mirrors OR add-on lane)
 *   - charge_mode chip on hover (DD4 DISPLAY-only)
 *
 * Zero raw palette classes — only .clin-pill / daylight tokens.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DayBoard, type SlotColorToken, type SuiteConfig, type SessionMeta } from "./DayBoard";
import { schedulerApi, type BoardResponse, type BookingRequestRow } from "@/lib/clinical-api";
import { ClinicalApiError } from "@/lib/clinical-api";
import { columnSort } from "@/lib/rcm/scheduler";

type ClinicSlot = { id: string; slot_at: string; status: string; capacity: number; booked_count: number };
type ClinicBooking = { id: string; status: string; charge_mode?: string | null; overbooked?: boolean; eligibility_check_pending?: boolean } | null;

function todayIso(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * HCA-0050 — column order comes from shared comparator in
 * src/lib/rcm/scheduler.ts (priority_rank ASC NULLS LAST, then
 * providers.display_name ASC locale-aware).
 */
function makeOpdConfig(board: BoardResponse): SuiteConfig<ClinicSlot, ClinicBooking> {
  return {
    suite: "opd_clinic",
    columns: board.columns as SessionMeta[],
    timeTicks: board.time_ticks,
    slotsBySession: board.slots_by_session as unknown as Record<string, Array<{ slot_at: string; slot: ClinicSlot }>>,
    bookingsBySlot: board.bookings_by_slot as unknown as Record<string, ClinicBooking>,
    columnSort: (a, b) => columnSort(
      { session_id: a.session_id, priority_rank: a.priority_rank, provider_display_name: a.provider_display_name },
      { session_id: b.session_id, priority_rank: b.priority_rank, provider_display_name: b.provider_display_name },
    ),
    columnBadges: (s) => {
      const chips: Array<{ label: string; tone?: "ok" | "warn" | "crit" | "info" | "mut" }> = [];
      if (s.telemedicine_capable) chips.push({ label: "Tele", tone: "info" });
      if (s.procedure_room)       chips.push({ label: "Proc", tone: "info" });
      if (s.wheelchair_access)    chips.push({ label: "♿",    tone: "mut" });
      if (s.female_clinic)        chips.push({ label: "♀",    tone: "warn" });
      return chips;
    },
    slotColor: (slot, booking): SlotColorToken => {
      if (slot.status === "blocked") return "blocked";
      if (!booking) return "open";
      switch (booking.status) {
        case "confirmed":  return "confirmed";
        case "arrived":    return "arrived";
        case "in_consult": return "in_consult";
        case "completed":  return "completed";
        case "no_show":    return "no_show";
        default:           return "booked";
      }
    },
    renderSlot: (slot, booking) => (
      <div className="flex flex-col gap-0.5">
        <span className="mono text-[10px]">
          {new Date(slot.slot_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {booking?.charge_mode && (
          <span className="clin-pill warn text-[9px]">{booking.charge_mode.replace(/_/g, " ")}</span>
        )}
        {booking?.overbooked && (
          <span className="clin-pill warn text-[9px]">⚠ overbook</span>
        )}
      </div>
    ),
  };
}

export function ClinicDayBoardPane() {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [requests, setRequests] = useState<BookingRequestRow[]>([]);
  const [day, setDay] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      return u.searchParams.get("day") ?? todayIso();
    }
    return todayIso();
  });
  const [clinicId, setClinicId] = useState<string | undefined>(() => {
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      return u.searchParams.get("clinic_id") ?? undefined;
    }
    return undefined;
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await schedulerApi.board({ date: day, clinic_id: clinicId });
        if (alive) setBoard(b.data);
        const rq = await schedulerApi.bookingRequests({ day });
        if (alive) setRequests(rq.data.rows ?? []);
      } catch (e) {
        if (e instanceof ClinicalApiError) toast.error(e.message);
      }
    })();
    return () => { alive = false; };
  }, [day, clinicId]);

  const config = useMemo(() => (board ? makeOpdConfig(board) : null), [board]);

  return (
    <div className="px-7 pt-6 pb-14 mx-auto" style={{ maxWidth: 1600, width: "100%" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Clinical → OPD Day Board</div>
          <h1 className="text-xl font-semibold">Clinic Day Board</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="mono text-[11px] px-2 py-1 rounded border border-hairline bg-panel"
            aria-label="Board date"
          />
          <input
            type="text"
            placeholder="clinic id (optional)"
            value={clinicId ?? ""}
            onChange={(e) => setClinicId(e.target.value || undefined)}
            className="mono text-[11px] px-2 py-1 rounded border border-hairline bg-panel w-64"
            aria-label="Clinic filter"
          />
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 320px" }}>
        <div>
          {config
            ? <DayBoard config={config} />
            : <div className="p-8 text-center text-muted-foreground clin-card">Loading board…</div>}
        </div>

        <aside className="space-y-3">
          <div className="clin-card p-3" data-testid="walk-in-lane">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Walk-in / urgent
            </div>
            <p className="text-xs text-muted-foreground">
              Smart Routing suggests first compatible open slot within specialty (display-only).
            </p>
          </div>

          <div className="clin-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Booking requests
              </div>
              <span className="clin-pill mut">{requests.length}</span>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {requests.length === 0 && (
                <div className="text-xs text-muted-foreground">No pending requests.</div>
              )}
              {requests.map((r) => (
                <div
                  key={`${r.kind}:${r.request_id}`}
                  className="rounded border border-hairline p-2 bg-card"
                  data-testid="booking-request-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{r.full_name ?? "—"}</div>
                    <span className={`clin-pill ${r.kind === "referral" ? "info" : r.kind === "rebook" ? "warn" : "mut"}`}>
                      {r.kind}
                    </span>
                  </div>
                  <div className="mono text-[10px] text-muted-foreground">
                    MRN {r.mrn ?? "—"} · {r.target_specialty ?? "—"}
                  </div>
                  {r.contact_number && (
                    <div className="mono text-[10px] text-muted-foreground">{r.contact_number}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}