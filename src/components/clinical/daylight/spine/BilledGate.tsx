/**
 * Spine primitive · <BilledGate>
 *
 * Renders a badge (green billed / amber released_by_exception / red locked)
 * and disables its child action while the gate is closed. Consumers pass in
 * an outcome shaped like `BilledGateOutcome` from `@/lib/rcm/billed-gate`.
 *
 * UI disabling is UX only — the server still 403s on unbilled charges via
 * `_order-factory` and the SQL `charge_is_billed()` guard trigger.
 */
import type { ReactNode } from "react";
import type { BilledGateOutcome } from "@/lib/rcm/billed-gate";
import { cn } from "@/lib/utils";

export type BilledGateProps = {
  outcome: BilledGateOutcome | null | undefined;
  children: ReactNode;
  className?: string;
};

function classify(o: BilledGateOutcome | null | undefined):
  { tone: "billed" | "released" | "locked" | "unknown"; label: string; tooltip: string } {
  if (!o) return { tone: "unknown", label: "…", tooltip: "Loading gate status" };
  if (o.billed && o.via === "release") return { tone: "released", label: "Released", tooltip: `Released by exception (${o.via})` };
  if (o.billed) return { tone: "billed", label: "Billed", tooltip: `Billed via ${o.via}` };
  return { tone: "locked", label: "Locked", tooltip: `Locked: ${o.reason}` };
}

export function BilledGate({ outcome, children, className }: BilledGateProps) {
  const { tone, label, tooltip } = classify(outcome);
  const disabled = !outcome?.billed;
  const pillTone =
    tone === "billed"   ? "ok"
  : tone === "released" ? "warn"
  : tone === "locked"   ? "crit"
  :                       "info";
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        title={tooltip}
        data-tone={tone}
        className={cn("clin-pill", pillTone)}
      >
        {label}
      </span>
      <div aria-disabled={disabled} className={cn(disabled && "pointer-events-none opacity-50")}>
        {children}
      </div>
    </div>
  );
}