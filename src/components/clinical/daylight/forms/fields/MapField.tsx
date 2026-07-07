/**
 * MAP field — computes only when both SBP and DBP are supplied.
 * MAP = (2·DBP + SBP) / 3.
 */
import { computeMAP } from "@/lib/clinical/form-validation";

export function MapField({
  sbp, dbp, onChangeSbp, onChangeDbp,
}: {
  sbp: number | null;
  dbp: number | null;
  onChangeSbp: (v: number | null) => void;
  onChangeDbp: (v: number | null) => void;
}) {
  const map = computeMAP(sbp, dbp);
  const partial = (sbp != null || dbp != null) && map == null;
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
      <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--clin-muted)" }}>
        SBP (mmHg)
        <input className="clin-ctrl mono" inputMode="numeric" value={sbp ?? ""} onChange={(e) => onChangeSbp(e.target.value ? Number(e.target.value) : null)} />
      </label>
      <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--clin-muted)" }}>
        DBP (mmHg)
        <input className="clin-ctrl mono" inputMode="numeric" value={dbp ?? ""} onChange={(e) => onChangeDbp(e.target.value ? Number(e.target.value) : null)} />
      </label>
      <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--clin-muted)" }}>
        MAP (computed)
        <input className="clin-ctrl mono" readOnly value={map ?? ""} placeholder={partial ? "Need both SBP + DBP" : ""} data-map-partial={partial ? "true" : "false"} />
        {partial && <span className="text-[10.5px]" style={{ color: "var(--clin-crit)" }}>MAP requires both SBP and DBP.</span>}
      </label>
    </div>
  );
}