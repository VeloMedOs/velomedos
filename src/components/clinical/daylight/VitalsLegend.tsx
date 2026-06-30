import { VITAL_RANGES } from "@/lib/clinical/vital-ranges";

/**
 * NEWS2-aligned legend explaining the colour bands used on the vitals
 * tiles. Always visible on mobile; popover on desktop. Cites the source
 * range in the tooltip so clinicians know what's normative.
 */
export function VitalsLegend({ compact = false }: { compact?: boolean }) {
  const rows: Array<{ k: keyof typeof VITAL_RANGES; }> = [
    { k: "hr" }, { k: "sbp" }, { k: "dbp" }, { k: "spo2" }, { k: "temp_c" }, { k: "rr" },
  ];
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="mono uppercase text-[10px] tracking-[0.12em]" style={{ color: "var(--clin-faint)" }}>Reference · NEWS2 adult</div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Swatch tone="ok" />   <span className="text-[11px]" style={{ color: "var(--clin-muted)" }}>Normal</span>
          <Swatch tone="warn" /> <span className="text-[11px]" style={{ color: "var(--clin-muted)" }}>Caution</span>
          <Swatch tone="crit" /> <span className="text-[11px]" style={{ color: "var(--clin-muted)" }}>Critical</span>
        </div>
      </div>
      {!compact && (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          {rows.map(({ k }) => {
            const r = VITAL_RANGES[k];
            return (
              <div key={k} className="text-[11.5px] flex items-baseline gap-2">
                <span className="font-semibold" style={{ color: "var(--clin-ink)" }}>{r.label}</span>
                <span className="mono" style={{ color: "var(--clin-muted)" }}>
                  {r.ok[0]}–{r.ok[1]} {r.unit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Swatch({ tone }: { tone: "ok" | "warn" | "crit" }) {
  const bg = tone === "ok" ? "var(--clin-ok)" : tone === "warn" ? "var(--clin-warn)" : "var(--clin-crit)";
  return <span className="inline-block rounded-sm" style={{ width: 10, height: 10, background: bg }} aria-hidden />;
}
