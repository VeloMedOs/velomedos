import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { ClinicalAPI, ClinicalApiError } from "@/lib/clinical-api";
import { Field } from "./Primitives";

/** snake_case tokens — must match DischargePayload LOV in hospitalization.ts */
const SEPARATION_MODES = [
  { v: "routine",                 label: "Routine — discharge home" },
  { v: "transfer",                label: "Transfer to other facility" },
  { v: "against_medical_advice",  label: "Against medical advice (AMA)" },
  { v: "discharge_self",          label: "Self-discharge / absconded" },
  { v: "deceased",                label: "Deceased" },
  { v: "still_admitted",          label: "Still admitted (interim)" },
] as const;

const DISPOSITIONS = [
  { v: "home",                  label: "Home (self-care)" },
  { v: "home_health",           label: "Home with community / home health" },
  { v: "rehab",                 label: "Rehabilitation facility" },
  { v: "skilled_nursing",       label: "Skilled nursing facility" },
  { v: "long_term_care",        label: "Long-term care" },
  { v: "acute_hospital",        label: "Acute care hospital" },
  { v: "psychiatric",           label: "Psychiatric facility" },
  { v: "hospice",               label: "Hospice" },
  { v: "morgue",                label: "Morgue" },
] as const;

export function DischargePanel({
  encId,
  onDone,
}: {
  encId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<string>("routine");
  const [disposition, setDisposition] = useState<string>("home");
  const [causeOfDeath, setCauseOfDeath] = useState("");

  async function submit() {
    if (mode === "deceased" && !causeOfDeath.trim()) {
      return toast.error("Cause of death is required when separation is 'deceased'");
    }
    setBusy(true);
    try {
      await ClinicalAPI.discharge(encId, {
        discharged_at: new Date().toISOString(),
        separation_mode: mode,
        discharge_disposition: disposition || null,
        cause_of_death: mode === "deceased" ? causeOfDeath.trim() : null,
      });
      toast.success("Encounter discharged");
      setOpen(false);
      onDone();
    } catch (e) {
      if (e instanceof ClinicalApiError) toast.error(e.message);
    } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl py-2.5 font-semibold text-sm inline-flex items-center justify-center gap-2"
        style={{ background: "var(--clin-ok)", color: "#fff" }}
      >
        <CheckCircle2 className="size-4" />Discharge…
      </button>
    );
  }

  return (
    <div className="rounded-xl p-3.5 flex flex-col gap-3" style={{ background: "var(--clin-sunken)", border: "1px solid var(--hairline)" }}>
      <div className="mono uppercase text-[10px] tracking-[0.12em]" style={{ color: "var(--clin-faint)" }}>Discharge / separation</div>
      <Field label="Separation mode" required>
        <select className="clin-ctrl" value={mode} onChange={(e) => setMode(e.target.value)}>
          {SEPARATION_MODES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Disposition">
        <select className="clin-ctrl" value={disposition} onChange={(e) => setDisposition(e.target.value)}>
          {DISPOSITIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </Field>
      {mode === "deceased" && (
        <Field label="Cause of death" required>
          <input
            className="clin-ctrl"
            value={causeOfDeath}
            onChange={(e) => setCauseOfDeath(e.target.value)}
            placeholder="ICD term or short narrative"
            maxLength={512}
          />
        </Field>
      )}
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={submit}
          className="rounded-lg px-4 py-2 font-semibold text-sm text-white disabled:opacity-60"
          style={{ background: "var(--clin-ok)" }}
        >
          {busy ? "Saving…" : "Confirm discharge"}
        </button>
        <button
          disabled={busy}
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm"
          style={{ border: "1px solid var(--hairline)", color: "var(--clin-text)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
