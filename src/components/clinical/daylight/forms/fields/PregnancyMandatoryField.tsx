/**
 * Pregnancy-status field — mandatory for females aged 15-55 on rad forms.
 */
import { isPregnancyMandatory } from "@/lib/clinical/form-validation";

export function PregnancyMandatoryField({
  gender, ageYears, value, onChange,
}: {
  gender: string | null;
  ageYears: number | null;
  value: string | null;
  onChange: (next: string) => void;
}) {
  const mandatory = isPregnancyMandatory(gender, ageYears);
  if (!mandatory) return null;
  return (
    <label className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--clin-ink)" }}>
      Pregnancy status <span style={{ color: "var(--clin-crit)" }}>(mandatory)</span>
      <select className="clin-ctrl" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-required="true">
        <option value="" disabled>Select</option>
        <option value="not_pregnant">Not pregnant</option>
        <option value="pregnant">Pregnant</option>
        <option value="unknown">Unknown / declined</option>
        <option value="lmp_documented">LMP documented</option>
      </select>
    </label>
  );
}