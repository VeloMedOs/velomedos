/**
 * Chart-open alerting popup — Dev Spec §5 "common alerting behaviour".
 * Split into two sections per correction Y5: patient background and
 * encounter-specific state. Session-scoped dismissal per encounter.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Star, X } from "lucide-react";
import { ClinicalAPI } from "@/lib/clinical-api";
import { DnrBanner } from "./DnrBanner";
import { IsolationChip } from "./IsolationChip";

type Alerts = {
  patient: { allergies: any[]; conditions_flags: any[]; is_vip: boolean };
  encounter: { dnr_flag: boolean; isolation_precaution: string | null };
};

const DISMISSED_KEY = "clinical.alerts.dismissed";

export function AlertingPopup({ encounterId }: { encounterId: string | null }) {
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!encounterId) return;
    const dismissed = sessionStorage.getItem(`${DISMISSED_KEY}:${encounterId}`);
    (async () => {
      try {
        const r = await ClinicalAPI.getEncounterAlerts(encounterId);
        setAlerts(r.data as Alerts);
        const has =
          (r.data as Alerts).encounter.dnr_flag ||
          (r.data as Alerts).encounter.isolation_precaution ||
          (r.data as Alerts).patient.is_vip ||
          (r.data as Alerts).patient.allergies.length > 0;
        if (has && !dismissed) setOpen(true);
      } catch { /* advisory */ }
    })();
  }, [encounterId]);

  if (!alerts) return null;
  const banner = <DnrBanner visible={alerts.encounter.dnr_flag} />;
  if (!open) return banner;

  function dismiss() {
    if (encounterId) sessionStorage.setItem(`${DISMISSED_KEY}:${encounterId}`, "1");
    setOpen(false);
  }

  return (
    <>
      {banner}
      <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Patient alerts">
        <div className="clin-card max-w-lg w-full p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5" style={{ color: "var(--clin-warn)" }} />
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--clin-ink)" }}>Patient alerts</h2>
            </div>
            <button onClick={dismiss} className="size-8 rounded-md hover:bg-black/5 inline-grid place-items-center" aria-label="Dismiss alerts">
              <X className="size-4" />
            </button>
          </div>

          <section className="mb-4">
            <h3 className="mono text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--clin-faint)" }}>Patient background</h3>
            <div className="flex flex-col gap-2">
              {alerts.patient.is_vip && (
                <div className="clin-pill info inline-flex items-center gap-1 w-max"><Star className="size-3" />VIP patient</div>
              )}
              {alerts.patient.allergies.length === 0 ? (
                <div className="text-[12.5px]" style={{ color: "var(--clin-muted)" }}>No allergies on file.</div>
              ) : (
                <ul className="text-[12.5px]" style={{ color: "var(--clin-ink)" }}>
                  {alerts.patient.allergies.map((a: any) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <span className="clin-pill crit">Allergy</span>
                      <span>{a.substance ?? a.name ?? a.code ?? "Unknown allergen"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <h3 className="mono text-[10.5px] uppercase tracking-wide mb-2" style={{ color: "var(--clin-faint)" }}>This encounter</h3>
            <div className="flex flex-wrap items-center gap-2">
              {alerts.encounter.dnr_flag && <span className="clin-pill crit">DNR</span>}
              <IsolationChip precaution={alerts.encounter.isolation_precaution} />
              {!alerts.encounter.dnr_flag && !alerts.encounter.isolation_precaution && (
                <span className="text-[12.5px]" style={{ color: "var(--clin-muted)" }}>No encounter-specific alerts.</span>
              )}
            </div>
          </section>

          <div className="mt-5 flex justify-end">
            <button onClick={dismiss} className="rounded-lg px-4 py-2 text-[12.5px] font-semibold" style={{ background: "var(--teal)", color: "#fff" }}>Acknowledge</button>
          </div>
        </div>
      </div>
    </>
  );
}