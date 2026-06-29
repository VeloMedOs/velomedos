/**
 * Vitals row → FHIR R4 Observation[].
 * One Observation per non-null measure with LOINC + UCUM.
 * // VERIFY URIs against NPHIES IG.
 */
export type VitalsRow = {
  id: string;
  recorded_at: string;
  body_position: string | null;
  body_site: string | null;
  temperature_c: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate_bpm: number | null;
  systolic_mmhg: number | null;
  diastolic_mmhg: number | null;
  spo2_pct: number | null;
  pain_score: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  glucose_mmol_l: number | null;
};

const LOINC = "http://loinc.org";
const UCUM = "http://unitsofmeasure.org";

type Measure = { code: string; display: string; field: keyof VitalsRow; unit: string; ucum: string };

const MEASURES: Measure[] = [
  { code: "8867-4",  display: "Heart rate",                field: "heart_rate_bpm",       unit: "beats/min", ucum: "/min" },
  { code: "9279-1",  display: "Respiratory rate",          field: "respiratory_rate_bpm", unit: "breaths/min", ucum: "/min" },
  { code: "8480-6",  display: "Systolic blood pressure",   field: "systolic_mmhg",        unit: "mmHg", ucum: "mm[Hg]" },
  { code: "8462-4",  display: "Diastolic blood pressure",  field: "diastolic_mmhg",       unit: "mmHg", ucum: "mm[Hg]" },
  { code: "8310-5",  display: "Body temperature",          field: "temperature_c",        unit: "Cel",  ucum: "Cel" },
  { code: "59408-5", display: "Oxygen saturation",         field: "spo2_pct",             unit: "%",    ucum: "%" },
  { code: "29463-7", display: "Body weight",               field: "weight_kg",            unit: "kg",   ucum: "kg" },
  { code: "8302-2",  display: "Body height",               field: "height_cm",            unit: "cm",   ucum: "cm" },
  { code: "39156-5", display: "Body mass index",           field: "bmi",                  unit: "kg/m2", ucum: "kg/m2" },
  { code: "38208-5", display: "Pain severity",             field: "pain_score",           unit: "{score}", ucum: "{score}" },
  { code: "15074-8", display: "Glucose",                   field: "glucose_mmol_l",       unit: "mmol/L", ucum: "mmol/L" },
];

export function vitalsToFhirBundle(
  row: VitalsRow,
  patientRef: string,
  encounterRef: string,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of MEASURES) {
    const v = row[m.field];
    if (v === null || v === undefined) continue;
    out.push({
      resourceType: "Observation",
      id: `${row.id}-${m.code}`,
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "vital-signs",
        }],
      }],
      code: { coding: [{ system: LOINC, code: m.code, display: m.display }] },
      subject: { reference: patientRef },
      encounter: { reference: encounterRef },
      effectiveDateTime: row.recorded_at,
      valueQuantity: {
        value: typeof v === "number" ? v : Number(v),
        unit: m.unit,
        system: UCUM,
        code: m.ucum,
      },
      bodySite: row.body_site ? { text: row.body_site } : undefined,
    });
  }
  return out;
}