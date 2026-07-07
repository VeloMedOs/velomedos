/**
 * Pure validators shared by the ClinicalForm host + server routes.
 *
 * `MEANING_INVALID` — mandatory string fields must carry actual meaning.
 * Rejects lone punctuation (`.`), whitespace-only, or 1-character non-alphanumeric
 * values so a doctor can't tick "mandatory" with `.`.
 *
 * `computeMAP` — Mean Arterial Pressure. Returns null when either component is
 * missing so a lone SBP or DBP does not synthesize a value.
 *
 * `pregnancyMandatory` — pregnancy status/date is mandatory for females aged
 * 15-55 on radiology orders. Boundaries inclusive per §5.
 */

export function meaningInvalid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  // 1-2 chars that are pure punctuation / whitespace
  if (/^[.\s,;:!?\-_/\\]{1,2}$/.test(trimmed)) return true;
  // Any length composed exclusively of non letter/number characters
  if (/^[^\p{L}\p{N}]+$/u.test(trimmed)) return true;
  return false;
}

export type MeaningIssue = { field: string; message: string };

export function validateMandatoryMeaning(
  answers: Record<string, unknown>,
  fields: Array<{ id: string; label?: string; required?: boolean; type?: string }>,
): MeaningIssue[] {
  const out: MeaningIssue[] = [];
  for (const f of fields) {
    if (!f.required) continue;
    if (f.type && f.type !== "text" && f.type !== "textarea" && f.type !== "string") continue;
    const v = answers?.[f.id];
    if (v === undefined || v === null) {
      out.push({ field: f.id, message: `${f.label ?? f.id} is required` });
      continue;
    }
    if (meaningInvalid(v)) {
      out.push({ field: f.id, message: `${f.label ?? f.id} must contain meaningful text (not '.' or a single symbol)` });
    }
  }
  return out;
}

export function computeMAP(sbp: number | null | undefined, dbp: number | null | undefined): number | null {
  if (sbp == null || dbp == null || Number.isNaN(sbp) || Number.isNaN(dbp)) return null;
  if (sbp <= 0 || dbp <= 0) return null;
  return Math.round((2 * dbp + sbp) / 3);
}

export function isPregnancyMandatory(gender: string | null | undefined, ageYears: number | null | undefined): boolean {
  if (!gender || typeof ageYears !== "number") return false;
  if (gender.toLowerCase() !== "female" && gender.toLowerCase() !== "f") return false;
  return ageYears >= 15 && ageYears <= 55;
}