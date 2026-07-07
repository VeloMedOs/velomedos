/**
 * Full-width red DNR banner. Renders when the encounter carries dnr_flag=true.
 * Visible to every role — this is Dev Spec §5 "common alerting" behaviour.
 */
import { AlertOctagon } from "lucide-react";

export function DnrBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      aria-label="DNR order in effect"
      className="w-full px-5 py-2.5 flex items-center gap-2 text-white font-semibold text-[13px]"
      style={{ background: "var(--clin-crit, #C7362F)" }}
    >
      <AlertOctagon className="size-4" />
      DNR — Do Not Resuscitate order in effect. Verify latest clinical attestation before acting.
    </div>
  );
}