/**
 * Spine primitive · <FormsGate>
 *
 * Mirrors `public.forms_gate_open()`: disables children while any mandatory
 * pre-form binding is unsubmitted for the encounter. Consumer supplies the
 * boolean; the server-side trigger remains the enforcing gate.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FormsGateProps = {
  open: boolean;
  missing?: string[];
  children: ReactNode;
  className?: string;
};

export function FormsGate({ open, missing, children, className }: FormsGateProps) {
  const tooltip = open ? "All mandatory forms submitted" : `Missing: ${(missing ?? []).join(", ") || "pre-forms"}`;
  return (
    <div className={cn("inline-flex items-center gap-2", className)} title={tooltip}>
      <span className={cn("clin-pill", open ? "ok" : "warn")}>
        {open ? "Forms OK" : "Forms pending"}
      </span>
      <div aria-disabled={!open} className={cn(!open && "pointer-events-none opacity-50")}>
        {children}
      </div>
    </div>
  );
}