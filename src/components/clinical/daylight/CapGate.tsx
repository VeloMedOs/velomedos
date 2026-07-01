import type { ReactElement, ReactNode } from "react";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";

/**
 * Cosmetic action-gate for RCM/Clinical buttons.
 *
 *   <CapGate role={role} cap="claim.post" mode="hide">
 *     <button …>Post payment</button>
 *   </CapGate>
 *
 * mode="hide"     → renders nothing when the role lacks the capability.
 * mode="disable"  → clones the child with disabled + a "no access" tooltip.
 *
 * Server routes still enforce authorization via requireClinicalModule; this
 * only shapes the UI.
 */
export function CapGate({
  role,
  cap,
  mode = "hide",
  children,
  fallback = null,
  disabledTitle = "You don't have permission for this action.",
}: {
  role: ClinicalRole | null | undefined;
  cap: string;
  mode?: "hide" | "disable";
  children: ReactNode;
  fallback?: ReactNode;
  disabledTitle?: string;
}) {
  const allowed = canPerform(role, cap);
  if (allowed) return <>{children}</>;
  if (mode === "hide") return <>{fallback}</>;

  // disable — clone the single child element
  if (typeof children === "object" && children !== null && "props" in (children as ReactElement)) {
    const child = children as ReactElement<any>;
    const merged = {
      ...(child.props ?? {}),
      disabled: true,
      "aria-disabled": true,
      title: disabledTitle,
      onClick: (e: any) => e?.preventDefault?.(),
      style: { ...(child.props?.style ?? {}), opacity: 0.4, cursor: "not-allowed" },
    };
    return <child.type {...merged} />;
  }
  return <>{fallback}</>;
}