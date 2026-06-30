import { Check } from "lucide-react";

export type MdsStep = { id: string; label: string; done: boolean };

/**
 * MDS completeness meter. Drives the §6 "MDS-first registration"
 * rule: compliance shown as encouraging progress, not a trap.
 */
export function MdsMeter({
  title = "Registration completeness",
  caption = "· CHI / NPHIES minimum data set",
  steps,
}: { title?: string; caption?: string; steps: MdsStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const pct = steps.length === 0 ? 0 : Math.round((done / steps.length) * 100);
  return (
    <div className="clin-card mb-6 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[15px] font-semibold" style={{ color: "var(--clin-ink)" }}>
          {title} <span className="font-normal text-[13px]" style={{ color: "var(--clin-muted)" }}>{caption}</span>
        </div>
        <div className="mono font-bold text-[22px]" style={{ color: pct >= 100 ? "var(--clin-ok)" : "var(--teal)" }}>{pct}%</div>
      </div>
      <div className="rounded-md overflow-hidden" style={{ height: 9, background: "var(--clin-sunken)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,var(--teal),#3FD0B5)", transition: "width .5s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div className="flex gap-2 mt-3.5 flex-wrap">
        {steps.map((s) => (
          <span
            key={s.id}
            className="mono text-[11px] inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
            style={{
              color: s.done ? "var(--clin-ok)" : "var(--clin-muted)",
              background: s.done ? "var(--clin-ok-tint)" : "var(--clin-sunken)",
            }}
          >
            <span className="grid place-items-center rounded-full" style={{ width: 14, height: 14, background: s.done ? "var(--clin-ok)" : "var(--clin-line-strong)" }}>
              {s.done && <Check className="size-2.5" color="#fff" strokeWidth={4} />}
            </span>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}