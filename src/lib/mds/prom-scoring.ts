/**
 * Phase 11 — PROM/PREM scoring engine.
 *
 * Pure, deterministic functions keyed by `instrument.schema.scoring`.
 *  - promis10:    PROMIS-10 Global Health → Physical Component Summary (PCS)
 *                 and Mental Component Summary (MCS) T-scores. Raw→T tables
 *                 reproduced from the public PROMIS scoring manual.
 *  - cataract_vf: simplified VF-style composite (0–100, higher = better).
 *  - prem_generic: weighted experience score (0–100) + NPS-style top-box rate.
 *
 * Scoring outputs are written once onto `prom_response.score` / `prem_response.score`
 * with the `instrument_version` snapshotted alongside.
 */

export type InstrumentItem = {
  id: string;
  label: string;
  type: "scale" | "number" | "single_choice";
  min?: number;
  max?: number;
  required?: boolean;
  reverse?: boolean;
  domain?: string;
  options?: Array<{ value: number; label: string }>;
};

export type InstrumentSchema = {
  items: InstrumentItem[];
  scoring: "promis10" | "cataract_vf" | "prem_generic";
};

export type Answers = Record<string, number>;
export type Score = Record<string, number | string>;

export type ValidationIssue = { item_id: string; message: string };

export function validateAnswers(
  schema: InstrumentSchema,
  answers: Answers,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const item of schema.items) {
    const value = answers[item.id];
    const present = value !== undefined && value !== null && !Number.isNaN(value);
    if (item.required && !present) {
      issues.push({ item_id: item.id, message: "required" });
      continue;
    }
    if (!present) continue;
    if (typeof value !== "number") {
      issues.push({ item_id: item.id, message: "must be a number" });
      continue;
    }
    if (item.min !== undefined && value < item.min) {
      issues.push({ item_id: item.id, message: `min ${item.min}` });
    }
    if (item.max !== undefined && value > item.max) {
      issues.push({ item_id: item.id, message: `max ${item.max}` });
    }
  }
  return issues;
}

/* ----------------------- PROMIS-10 ----------------------- */

/**
 * Physical Health raw (sum of global03, global06, global07, global08 reverse,
 * global09 reverse, with global10 recoded 0-10 → 5-point) → T-score.
 * Source: PROMIS Scoring Manual, Global Health Short Form v1.2 (2017).
 */
const PCS_RAW_TO_T: Record<number, number> = {
  4: 16.2, 5: 19.9, 6: 23.5, 7: 26.7, 8: 29.5, 9: 32.0, 10: 34.3,
  11: 36.5, 12: 38.6, 13: 40.7, 14: 42.7, 15: 44.9, 16: 47.2,
  17: 49.7, 18: 52.5, 19: 55.8, 20: 61.9,
};

const MCS_RAW_TO_T: Record<number, number> = {
  4: 21.2, 5: 25.1, 6: 28.4, 7: 31.3, 8: 33.8, 9: 36.3, 10: 38.8,
  11: 41.1, 12: 43.5, 13: 45.8, 14: 48.3, 15: 50.8, 16: 53.3,
  17: 56.0, 18: 59.0, 19: 62.5, 20: 67.6,
};

function recodePain(v: number): number {
  // global10 is 0-10. Recode per PROMIS-10 manual: 0=5, 1-2=4, 3-4=3, 5-6=2, 7-9=1, 10=1.
  if (v <= 0) return 5;
  if (v <= 2) return 4;
  if (v <= 4) return 3;
  if (v <= 6) return 2;
  return 1;
}

function pickTScore(table: Record<number, number>, raw: number): number {
  const min = Math.min(...Object.keys(table).map(Number));
  const max = Math.max(...Object.keys(table).map(Number));
  const clamped = Math.max(min, Math.min(max, Math.round(raw)));
  return table[clamped];
}

export function scorePromis10(answers: Answers): Score {
  const g = (k: string) => Number(answers[k] ?? 0);
  // PCS items: global03, global06, global07, global08, global09, global10(recoded), with reverse where flagged.
  // PROMIS Global v1.2: PCS uses global03, global06, global07, global10(recoded). MCS uses global02, global04, global05, global08(reverse).
  const pcsRaw = g("global03") + g("global06") + g("global07") + recodePain(g("global10"));
  const mcsRaw = g("global02") + g("global04") + g("global05") + (6 - g("global08"));
  const pcs = pickTScore(PCS_RAW_TO_T, pcsRaw);
  const mcs = pickTScore(MCS_RAW_TO_T, mcsRaw);
  return {
    pcs_raw: pcsRaw,
    mcs_raw: mcsRaw,
    pcs,
    mcs,
    method: "promis10_v1.2",
  };
}

/* ----------------------- Cataract VF ----------------------- */

export function scoreCataractVF(answers: Answers): Score {
  const ids = ["vf1", "vf2", "vf3", "vf4", "vf5"];
  const values = ids.map((id, idx) => {
    const v = Number(answers[id] ?? 0);
    // vf5 is reverse-scored (satisfaction: higher = better; others: higher difficulty = worse)
    return idx === 4 ? v : 6 - v;
  });
  const raw = values.reduce((a, b) => a + b, 0); // 5..25
  const composite = Math.round(((raw - 5) / 20) * 100); // 0..100, higher = better
  return { raw, composite, method: "cataract_vf_v1" };
}

/* ----------------------- PREM generic ----------------------- */

export function scorePremGeneric(answers: Answers): Score {
  const overall = Number(answers["px1"] ?? 0); // 0..10
  const five = ["px2", "px3", "px4", "px5"].map((id) => Number(answers[id] ?? 0));
  const fiveNormalized = five.map((v) => ((v - 1) / 4) * 100);
  const composite = Math.round(
    (overall * 10 * 0.4) + (fiveNormalized.reduce((a, b) => a + b, 0) / four(fiveNormalized)) * 0.6,
  );
  const topBox = five.filter((v) => v === 5).length;
  return {
    overall_0_10: overall,
    composite_0_100: composite,
    top_box_count: topBox,
    recommend: Number(answers["px5"] ?? 0),
    method: "prem_generic_v1",
  };
}

function four(arr: number[]): number {
  // tiny helper to avoid division-by-zero in case all items are missing.
  return Math.max(1, arr.length);
}

/* ----------------------- Dispatcher ----------------------- */

export function scoreProm(
  scoring: InstrumentSchema["scoring"],
  answers: Answers,
): Score {
  switch (scoring) {
    case "promis10":
      return scorePromis10(answers);
    case "cataract_vf":
      return scoreCataractVF(answers);
    case "prem_generic":
      return scorePremGeneric(answers);
    default:
      return { method: "unscored" };
  }
}