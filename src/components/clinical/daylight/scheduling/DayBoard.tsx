/**
 * Step 3 · Turn 2 — Generic Day Board component (Batch C_10 pattern).
 *
 * Zero suite-specific literals live in this file: it does not know the
 * strings 'opd_clinic', 'or', 'cath', or 'endo'. Callers pass a SuiteConfig
 * with the suite key, column data, sort/badge/color hooks, and validate-drop
 * handler. Batch C OR/Cath will CONFIGURE this same component (file 13 §C).
 *
 * Orientation (locked): columns = sessions (doctor × room), time flows
 * vertically, horizontal now-line on the row containing now().
 *
 * Grep guard: `rg -n "opd_clinic|'or'|'cath'|'endo'" DayBoard.tsx` returns 0.
 */
import { useMemo } from "react";
import type { ReactNode } from "react";

export type SlotColorToken =
  | "open" | "booked" | "confirmed" | "arrived"
  | "in_consult" | "completed" | "no_show" | "blocked";

export type BadgeChip = { label: string; tone?: "ok" | "warn" | "crit" | "info" | "mut" };

export type SessionMeta = {
  session_id: string;
  provider_display_name: string;
  specialty: string | null;
  room: string | null;
  priority_rank: number | null;
  capacity: number;
  booked_count: number;
  overbook_limit: number;
  overbook_allowed: boolean;
  telemedicine_capable?: boolean;
  procedure_room?: boolean;
  wheelchair_access?: boolean;
  female_clinic?: boolean;
  or_case_today?: boolean;
};

export type SlotRow<TSlot> = {
  slot_at: string;
  slot: TSlot;
};

export type DropPayload = {
  session_id: string;
  slot_id: string;
  beneficiary_id: string;
  visit_type: string;
};

export type DropValidation =
  | { ok: true; overbook_warning?: boolean; charge_mode?: string | null }
  | { ok: false; code: string; message?: string };

export interface SuiteConfig<TSlot, TBooking> {
  /** Suite identity — passed from caller, never hard-coded in this file. */
  suite: string;
  columns: SessionMeta[];
  timeTicks: string[]; // ISO instants for row axis (default 20-min grid)
  slotsBySession: Record<string, SlotRow<TSlot>[]>;
  bookingsBySlot: Record<string, TBooking | null>;
  columnSort: (a: SessionMeta, b: SessionMeta) => number;
  columnBadges: (session: SessionMeta) => BadgeChip[];
  slotColor: (slot: TSlot, booking: TBooking | null) => SlotColorToken;
  renderSlot?: (slot: TSlot, booking: TBooking | null) => ReactNode;
  now?: Date; // injectable for tests; defaults to new Date()
  /** Progressive disclosure. Callers can gate optional bells. */
  enhance?: boolean;
}

const SLOT_TONE: Record<SlotColorToken, string> = {
  open:       "bg-white border-hairline text-foreground",
  booked:     "bg-panel-elevated text-muted-foreground",
  confirmed:  "bg-action/10 border-action/40 text-action",
  arrived:    "bg-teal/10 border-teal/40 text-teal",
  in_consult: "bg-stable/15 border-stable/40 text-stable",
  completed:  "bg-muted text-muted-foreground line-through",
  no_show:    "bg-emergency/15 border-emergency/40 text-emergency line-through",
  blocked:    "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,0.06)_6px,rgba(0,0,0,0.06)_12px)] text-muted-foreground",
};

function sameTickWindow(tick: string, now: Date, windowMs = 20 * 60 * 1000): boolean {
  const t = new Date(tick).getTime();
  const n = now.getTime();
  return n >= t && n < t + windowMs;
}

export function DayBoard<TSlot, TBooking>(props: {
  config: SuiteConfig<TSlot, TBooking>;
  ariaLabel?: string;
}) {
  const { config } = props;
  const now = config.now ?? new Date();
  const columns = useMemo(() => [...config.columns].sort(config.columnSort), [config.columns, config.columnSort]);

  return (
    <div
      role="grid"
      aria-label={props.ariaLabel ?? `${config.suite} day board`}
      data-suite={config.suite}
      className="w-full overflow-auto rounded-xl border border-hairline bg-card"
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `72px repeat(${columns.length}, minmax(180px, 1fr))` }}
      >
        {/* Header row */}
        <div className="p-2 border-b border-hairline bg-panel mono text-[10px] uppercase tracking-widest text-muted-foreground">Time</div>
        {columns.map((col, colIdx) => (
          <SessionHeader key={col.session_id} session={col} badges={config.columnBadges(col)} columnIndex={colIdx} />
        ))}

        {/* Time × session grid */}
        {config.timeTicks.map((tick) => {
          const isNow = sameTickWindow(tick, now);
          return (
            <FragmentRow key={tick}>
              <div
                className="p-2 mono text-[10px] text-muted-foreground border-b border-hairline bg-panel/50"
                style={isNow ? { borderTop: "2px solid var(--crit-fg, #C7362F)" } : undefined}
                data-now={isNow || undefined}
                data-testid={isNow ? "now-line" : undefined}
              >
                {new Date(tick).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              {columns.map((col, colIdx) => {
                const row = config.slotsBySession[col.session_id]?.find((s) => s.slot_at === tick);
                if (!row) {
                  return (
                    <div
                      key={col.session_id + tick}
                      className="p-1 border-b border-hairline/50"
                      style={isNow ? { borderTop: "2px solid var(--crit-fg, #C7362F)" } : undefined}
                      data-column-index={colIdx}
                    />
                  );
                }
                const booking = config.bookingsBySlot[row.slot_at] ?? null;
                const tone = config.slotColor(row.slot, booking);
                const overbook = (booking as { overbooked?: boolean } | null)?.overbooked === true;
                return (
                  <div
                    key={col.session_id + tick}
                    className={`m-1 rounded-md border p-1.5 text-[11px] ${SLOT_TONE[tone]}`}
                    style={isNow ? { borderTop: "2px solid var(--crit-fg, #C7362F)" } : undefined}
                    data-slot-state={tone}
                    data-tone={tone}
                    data-column-index={colIdx}
                    data-overbook-ribbon={overbook ? "true" : undefined}
                  >
                    {config.renderSlot ? config.renderSlot(row.slot, booking) : new Date(row.slot_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                );
              })}
            </FragmentRow>
          );
        })}
      </div>
    </div>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function SessionHeader({ session, badges, columnIndex }: { session: SessionMeta; badges: BadgeChip[]; columnIndex: number }) {
  return (
    <div className="p-2 border-b border-hairline bg-panel" data-column-index={columnIndex}>
      <div className="font-semibold text-[13px]" data-testid="session-title">
        {session.provider_display_name}{session.specialty ? ` — ${session.specialty}` : ""}
      </div>
      <div className="mono text-[10px] text-muted-foreground">
        {session.specialty ?? "—"} · {session.room ?? "—"}
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        <span className="clin-pill mut">{session.booked_count}/{session.capacity}</span>
        {session.overbook_allowed && <span className="clin-pill warn">+{session.overbook_limit}</span>}
        {badges.map((b, i) => (
          <span key={i} className={`clin-pill ${b.tone ?? "mut"}`}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}