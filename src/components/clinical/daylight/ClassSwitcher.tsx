/**
 * Class switcher chip — writes to `?class=` search param on the clinical
 * workspace route. Worklist panes read the same param. Spec 05 §2 — one
 * class model (`AMB / EMER / IMP / HH / VR / ALL`).
 */
import { useNavigate, useSearch } from "@tanstack/react-router";

export type EncounterClass = "AMB" | "EMER" | "IMP" | "HH" | "VR";

const CLASSES: Array<{ id: EncounterClass | "ALL"; label: string }> = [
  { id: "ALL",  label: "All" },
  { id: "AMB",  label: "OPD" },
  { id: "EMER", label: "ER" },
  { id: "IMP",  label: "IPD" },
  { id: "HH",   label: "HH" },
  { id: "VR",   label: "VR" },
];

export function ClassSwitcher() {
  const nav = useNavigate();
  const search = useSearch({ from: "/_authenticated/clinical" }) as { class?: string; tab?: string };
  const current = (search.class ?? "ALL") as EncounterClass | "ALL";
  return (
    <div
      role="tablist"
      aria-label="Encounter class"
      className="inline-flex items-center gap-1 rounded-lg p-1 mono text-[11px]"
      style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}
    >
      {CLASSES.map((c) => {
        const on = c.id === current;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => nav({
              to: "/clinical",
              search: (prev) => ({ ...prev, class: c.id === "ALL" ? undefined : c.id }),
            })}
            className="px-2.5 h-6 rounded-md transition-colors"
            style={{
              background: on ? "var(--clin-teal-tint)" : "transparent",
              color: on ? "var(--teal)" : "var(--clin-muted)",
              fontWeight: on ? 700 : 500,
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Role → home-class default when `?class=` is unset.
 * physician / most roles default to ALL; niche roles land on their own class.
 */
export function homeClassForRole(role: string | null | undefined): EncounterClass | undefined {
  switch (role) {
    case "nurse":         return "IMP";
    case "ambulance_ems": return "EMER";
    case "floor_manager": return "IMP";
    case "front_office":  return "AMB";
    default:              return undefined; // ALL
  }
}