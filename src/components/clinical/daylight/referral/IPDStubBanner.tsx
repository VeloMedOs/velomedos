/**
 * Step 5 · Turn 2 UI — IPD fan-out stub banner.
 * Rendered when a fan-out response contains an IPD target with
 * `admission_request_id` + `awaiting[]`. The IPD Admission Request pane
 * currently lives under the `wl-admission` tab; when a future pane owns
 * `ip-admission-requests` directly the query key just changes.
 */
import { Link } from "@tanstack/react-router";

export function IPDStubBanner({
  admissionRequestId, awaiting, disabled,
}: { admissionRequestId?: string; awaiting: string[]; disabled?: boolean }) {
  const label = `IPD admission request awaiting: ${awaiting.join(", ")}`;
  if (disabled || !admissionRequestId) {
    return (
      <div className="clin-pill warn" data-testid="ipd-stub-banner-disabled" style={{ display: "block", padding: "8px 12px", fontSize: 12 }}>
        {label} · IPD Admission Request pane pending (logged to interface_log)
      </div>
    );
  }
  return (
    <div className="clin-pill info" data-testid="ipd-stub-banner" style={{ display: "block", padding: "8px 12px", fontSize: 12 }}>
      {label} ·{" "}
      <Link
        to="/clinical"
        search={{ tab: "wl-admission", id: admissionRequestId } as any}
        className="underline"
      >
        Open IPD Admission Request →
      </Link>
    </div>
  );
}