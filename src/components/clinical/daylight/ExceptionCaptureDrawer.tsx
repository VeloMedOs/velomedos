/**
 * R1 · Exception evidence capture.
 * Referral / Emergency (CTAS 1-2) / Newborn (with mother coverage picker).
 * POSTs to /api/clinical/v1/eligibility/:id/exception which then transitions
 * the visit_eligibility row into `exception_review`.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Upload, AlertTriangle, Baby, FileSignature } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";

type ExceptionType = "referral" | "emergency" | "newborn";

export function ExceptionCaptureDrawer({
  visitEligibilityId,
  onClose,
  onSaved,
}: {
  visitEligibilityId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<ExceptionType>("referral");
  const [busy, setBusy] = useState(false);
  // Referral fields
  const [refUrl, setRefUrl] = useState("");
  const [refNo, setRefNo] = useState("");
  const [refProvider, setRefProvider] = useState("");
  const [refDate, setRefDate] = useState("");
  // Emergency fields
  const [ctas, setCtas] = useState<number>(1);
  // Newborn fields
  const [birthCertUrl, setBirthCertUrl] = useState("");
  const [motherMembership, setMotherMembership] = useState("");
  const [motherCoverageId, setMotherCoverageId] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { exception_type: kind, notes: notes || null };
      if (kind === "referral") {
        if (!refUrl && !refNo) { toast.error("Add a referral letter URL or reference number."); setBusy(false); return; }
        body.referral_letter_url = refUrl || null;
        body.referral_ref_no     = refNo  || null;
        body.referred_provider   = refProvider || null;
        body.referral_date       = refDate || null;
      } else if (kind === "emergency") {
        if (![1, 2].includes(ctas)) { toast.error("Emergency exceptions require CTAS level 1 or 2."); setBusy(false); return; }
        body.ctas_level = ctas;
      } else {
        if (!motherCoverageId && !motherMembership) { toast.error("Add the mother's coverage or membership no."); setBusy(false); return; }
        body.birth_certificate_url = birthCertUrl || null;
        body.mother_membership_no  = motherMembership || null;
        body.mother_coverage_id    = motherCoverageId || null;
      }
      await ClinicalAPI.raiseEligibilityException(visitEligibilityId, body);
      toast.success("Exception captured · moved to exception_review");
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[460px] bg-white shadow-2xl flex flex-col"
           style={{ borderLeft: "1px solid var(--hairline)" }}>
        <header className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--hairline)" }}>
          <div>
            <div className="mono uppercase text-[10px] tracking-widest" style={{ color: "var(--clin-faint)" }}>Capture exception</div>
            <div className="font-semibold text-[15px]" style={{ color: "var(--clin-ink)" }}>Eligibility · {visitEligibilityId.slice(0, 8)}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-black/5"><X className="size-4" /></button>
        </header>

        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          <KindTile active={kind === "referral"}  onClick={() => setKind("referral")}  icon={FileSignature} label="Referral" />
          <KindTile active={kind === "emergency"} onClick={() => setKind("emergency")} icon={AlertTriangle} label="Emergency" />
          <KindTile active={kind === "newborn"}   onClick={() => setKind("newborn")}   icon={Baby}          label="Newborn" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {kind === "referral" && (
            <>
              <Field label="Referral letter URL" icon={Upload}>
                <input value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="https://…" className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
              </Field>
              <Field label="Reference number">
                <input value={refNo} onChange={(e) => setRefNo(e.target.value)} className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Referring provider">
                  <input value={refProvider} onChange={(e) => setRefProvider(e.target.value)} className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
                </Field>
                <Field label="Referral date">
                  <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
                </Field>
              </div>
            </>
          )}
          {kind === "emergency" && (
            <Field label="CTAS level (must be 1 or 2)">
              <div className="flex gap-2 mt-1">
                {[1, 2].map((v) => (
                  <button key={v} onClick={() => setCtas(v)}
                          className="px-3 h-9 rounded mono text-[12px] font-semibold"
                          style={{
                            background: ctas === v ? "var(--clin-crit-tint)" : "var(--clin-sunken)",
                            color: ctas === v ? "var(--clin-crit)" : "var(--clin-muted)",
                            border: "1px solid var(--hairline)",
                          }}>
                    CTAS {v}
                  </button>
                ))}
              </div>
              <div className="text-[11px] mt-1" style={{ color: "var(--clin-muted)" }}>
                CTAS ≥ 3 is not an eligibility exception — route to self-pay or standard workflow.
              </div>
            </Field>
          )}
          {kind === "newborn" && (
            <>
              <Field label="Birth certificate URL">
                <input value={birthCertUrl} onChange={(e) => setBirthCertUrl(e.target.value)} placeholder="https://…" className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
              </Field>
              <Field label="Mother — coverage ID (UUID)">
                <input value={motherCoverageId} onChange={(e) => setMotherCoverageId(e.target.value)} placeholder="paste coverage id" className="clin-ctrl w-full mono text-[11px]" style={{ padding: "6px 8px" }} />
              </Field>
              <Field label="Mother — membership number">
                <input value={motherMembership} onChange={(e) => setMotherMembership(e.target.value)} className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
              </Field>
              <div className="text-[11px]" style={{ color: "var(--clin-muted)" }}>
                Coverage ID or membership number is required; mother must have an active policy.
              </div>
            </>
          )}

          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="clin-ctrl w-full" style={{ padding: "6px 8px" }} />
          </Field>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--hairline)" }}>
          <button onClick={onClose} className="px-3 h-9 rounded mono text-[11px] uppercase tracking-widest" style={{ border: "1px solid var(--hairline)", color: "var(--clin-text)" }}>Cancel</button>
          <button onClick={submit} disabled={busy} className="px-3 h-9 rounded mono text-[11px] uppercase tracking-widest text-white disabled:opacity-40" style={{ background: "var(--teal)" }}>
            {busy ? "Saving…" : "Capture · Move to review"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function KindTile({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button onClick={onClick}
            className="rounded-lg p-3 flex flex-col items-center gap-1"
            style={{
              background: active ? "var(--clin-teal-tint)" : "var(--clin-sunken)",
              color: active ? "var(--teal)" : "var(--clin-muted)",
              border: `1px solid ${active ? "var(--teal)" : "var(--hairline)"}`,
            }}>
      <Icon className="size-4" />
      <span className="mono text-[10.5px] uppercase tracking-widest font-semibold">{label}</span>
    </button>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="mono uppercase text-[10px] tracking-widest flex items-center gap-1" style={{ color: "var(--clin-faint)" }}>
        {Icon && <Icon className="size-3" />}{label}
      </span>
      {children}
    </label>
  );
}