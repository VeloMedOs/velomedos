/**
 * Universal worklist filter chips (spec 05 §4).
 * Presentational — parents own the state.
 */
import { cn } from "@/lib/utils";

export type Urgency = "all" | "stat" | "urgent" | "routine";
export type RcmStatus = "all" | "approved" | "further_details" | "rejected" | "pending";

export function UrgencyChips({ value, onChange }: { value: Urgency; onChange: (v: Urgency) => void }) {
  const items: Array<{ id: Urgency; label: string; tone?: string }> = [
    { id: "all",     label: "All" },
    { id: "stat",    label: "STAT",    tone: "crit" },
    { id: "urgent",  label: "Urgent",  tone: "warn" },
    { id: "routine", label: "Routine", tone: "muted" },
  ];
  return <ChipRow label="Urgency" items={items} value={value} onChange={(v) => onChange(v as Urgency)} />;
}

export function RcmStatusChips({ value, onChange }: { value: RcmStatus; onChange: (v: RcmStatus) => void }) {
  const items: Array<{ id: RcmStatus; label: string; tone?: string }> = [
    { id: "all",              label: "All" },
    { id: "approved",         label: "Approved",        tone: "ok" },
    { id: "further_details",  label: "Further details", tone: "warn" },
    { id: "rejected",         label: "Rejected",        tone: "crit" },
    { id: "pending",          label: "Pending",         tone: "muted" },
  ];
  return <ChipRow label="RCM" items={items} value={value} onChange={(v) => onChange(v as RcmStatus)} />;
}

function ChipRow<T extends string>({
  label, items, value, onChange,
}: {
  label: string;
  items: Array<{ id: T; label: string; tone?: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="mono text-[10px] uppercase tracking-widest mr-1" style={{ color: "var(--clin-muted)" }}>
        {label}
      </span>
      {items.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              "px-2.5 h-6 rounded-full border transition-colors",
              on ? `clin-pill ${c.tone ?? "info"}` : "",
            )}
            style={{
              borderColor: on ? "transparent" : "var(--hairline)",
              background: on ? undefined : "var(--clin-card, #fff)",
              color: on ? undefined : "var(--clin-muted)",
              fontWeight: on ? 700 : 600,
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function formatWait(sec: number | null | undefined): string {
  if (!sec || sec < 0) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export function waitTone(sec: number | null | undefined): "muted" | "warn" | "crit" {
  if (!sec || sec < 30 * 60) return "muted";
  if (sec < 60 * 60) return "warn";
  return "crit";
}