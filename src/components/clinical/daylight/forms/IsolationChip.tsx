import { ShieldAlert } from "lucide-react";

/**
 * Chip surfacing non-Standard precautions on the encounter.
 */
export function IsolationChip({ precaution }: { precaution: string | null }) {
  if (!precaution) return null;
  return (
    <span className="clin-pill warn inline-flex items-center gap-1" title="Isolation precaution">
      <ShieldAlert className="size-3" />
      {precaution}
    </span>
  );
}