import { Activity } from "lucide-react";

/**
 * VTE risk indicator icon.
 */
export function VteIcon({ risk }: { risk: "low" | "moderate" | "high" | null }) {
  if (!risk) return null;
  const tone = risk === "high" ? "crit" : risk === "moderate" ? "warn" : "ok";
  return (
    <span className={`clin-pill ${tone} inline-flex items-center gap-1`} title={`VTE risk: ${risk}`}>
      <Activity className="size-3" />VTE {risk}
    </span>
  );
}