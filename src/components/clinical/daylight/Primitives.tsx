import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Daylight card with optional icon header and right-side action / pill. */
export function DCard({
  title, caption, icon: Icon, action, status, children,
}: {
  title: string;
  caption?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="clin-card mb-4">
      <header className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="size-7 rounded-lg grid place-items-center" style={{ background: "var(--clin-teal-tint)" }}>
              <Icon className="size-4" style={{ color: "var(--teal)" }} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-[15px] truncate" style={{ color: "var(--clin-ink)" }}>{title}</h3>
            {caption && <div className="mono text-[11.5px]" style={{ color: "var(--clin-muted)" }}>{caption}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status}
          {action}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Right-rail card. */
export function RailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="clin-card p-4">
      <div className="mono uppercase text-[10px] tracking-[0.12em] mb-3" style={{ color: "var(--clin-faint)" }}>{title}</div>
      {children}
    </div>
  );
}

/** Key / value row inside a rail card. */
export function KV({ k, v, tone }: { k: string; v: ReactNode; tone?: "ok" | "warn" | "info" | "crit" }) {
  const tones: Record<string, string> = {
    ok: "var(--clin-ok)",
    warn: "var(--clin-warn)",
    info: "var(--clin-info)",
    crit: "var(--clin-crit)",
  };
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]" style={{ borderTop: "1px solid var(--hairline)" }}>
      <span style={{ color: "var(--clin-muted)" }}>{k}</span>
      <span className="mono font-semibold text-[12.5px]" style={{ color: tone ? tones[tone] : "var(--clin-ink)" }}>{v}</span>
    </div>
  );
}

/** Labelled field. */
export function Field({ label, required, hint, children, full }: {
  label: string; required?: boolean; hint?: string; children: ReactNode; full?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5" style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <span className="text-[12px] font-semibold" style={{ color: "var(--clin-text)" }}>
        {label}{required && <span style={{ color: "var(--teal)" }}> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px]" style={{ color: "var(--clin-faint)" }}>{hint}</span>}
    </label>
  );
}

/** Yes / no segmented control. */
export function Seg2({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<{ v: string; label: string }> }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className="flex-1 rounded-lg py-2.5 font-medium text-sm transition"
            style={{
              border: `1px solid ${on ? "var(--teal)" : "var(--hairline)"}`,
              background: on ? "var(--clin-teal-tint)" : "var(--clin-raised)",
              color: on ? "var(--teal)" : "var(--clin-text)",
              fontWeight: on ? 600 : 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Big primary CTA. */
export function CTA({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="w-full rounded-xl py-3 font-semibold text-[14.5px] transition disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background: "var(--teal)",
        color: "#fff",
        boxShadow: "0 6px 16px rgba(14,156,134,.25)",
      }}
    >
      {children}
    </button>
  );
}