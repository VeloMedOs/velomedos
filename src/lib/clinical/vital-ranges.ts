/**
 * Adult vital sign ranges aligned to NEWS2 (Royal College of Physicians,
 * National Early Warning Score 2, 2017). Tones map to Daylight tokens:
 *   ok   — within physiologic norm
 *   warn — NEWS2 score 1–2 deflection
 *   crit — NEWS2 score ≥3 or red parameter
 * Blood pressure is scored on SBP and DBP independently; the worst
 * tone wins.
 */
export type Tone = "ok" | "warn" | "crit";
export type Metric = "hr" | "sbp" | "dbp" | "spo2" | "temp_c" | "rr";

export const VITAL_RANGES: Record<Metric, { ok: [number, number]; warn?: Array<[number, number]>; critLow?: number; critHigh?: number; unit: string; label: string }> = {
  hr:     { ok: [60, 100],  warn: [[50, 59], [101, 110]], critLow: 40,   critHigh: 131, unit: "bpm",  label: "Heart rate" },
  sbp:    { ok: [90, 139],  warn: [[80, 89], [140, 159]], critLow: 80,   critHigh: 160, unit: "mmHg", label: "Systolic BP" },
  dbp:    { ok: [60, 89],   warn: [[50, 59], [90, 99]],   critLow: 50,   critHigh: 100, unit: "mmHg", label: "Diastolic BP" },
  spo2:   { ok: [95, 100],  warn: [[92, 94]],             critLow: 92,                  unit: "%",    label: "SpO₂" },
  temp_c: { ok: [36.0, 37.5], warn: [[35.0, 35.9], [37.6, 38.4]], critLow: 35.0, critHigh: 38.5, unit: "°C", label: "Temp" },
  rr:     { ok: [12, 20],   warn: [[9, 11], [21, 24]],    critLow: 9,    critHigh: 25,  unit: "/min", label: "Resp rate" },
};

export function classify(metric: Metric, value: number | null | undefined): Tone {
  if (value == null || Number.isNaN(value)) return "ok";
  const r = VITAL_RANGES[metric];
  if (r.critLow != null && value < r.critLow) return "crit";
  if (r.critHigh != null && value >= r.critHigh) return "crit";
  if (r.warn?.some(([lo, hi]) => value >= lo && value <= hi)) return "warn";
  if (value >= r.ok[0] && value <= r.ok[1]) return "ok";
  return "warn";
}

/** Worst-tone wins across many readings. */
export function worstTone(tones: Tone[]): Tone {
  if (tones.includes("crit")) return "crit";
  if (tones.includes("warn")) return "warn";
  return "ok";
}
