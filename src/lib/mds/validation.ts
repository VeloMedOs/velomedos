/**
 * Phase 10 — Strict clinical readiness validator.
 *
 * Inputs are the bundle loaded by claim-loader; output is { ok, missing[] }.
 * Categories use the DB enum (underscored: history_of_present_illness, …).
 * Vitals come from `vitals_observation` columns, not as a CSI category.
 * Hyphenated NPHIES codes are emitted only by the Phase-7 FHIR mapper.
 */
import type { ReadinessBundle } from "./claim-loader";

export type MissingItem = {
  code: string;
  category: string;
  stage: "mds" | "drg" | "rcm";
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  ok: boolean;
  missing: MissingItem[];
  drg: {
    required: boolean;
    present: boolean;
    grouper_version_ok: boolean;
    los_ok: boolean;
    achi_ok: boolean;
    pdx_match_ok: boolean;
  };
};

const NARRATIVE_REQUIRED = [
  "history_of_present_illness",
  "physical_examination",
  "treatment_plan",
  "patient_history",
  "investigation_result",
] as const;

const VITALS_REQUIRED: Array<{ key: string; field: string; label: string }> = [
  { key: "temperature", field: "temperature_c", label: "Temperature" },
  { key: "pulse", field: "heart_rate_bpm", label: "Pulse / heart rate" },
  { key: "respiratory_rate", field: "respiratory_rate_bpm", label: "Respiratory rate" },
  { key: "spo2", field: "spo2_pct", label: "Oxygen saturation" },
  { key: "systolic", field: "systolic_mmhg", label: "Systolic BP" },
  { key: "diastolic", field: "diastolic_mmhg", label: "Diastolic BP" },
  { key: "weight", field: "weight_kg", label: "Weight" },
  { key: "height", field: "height_cm", label: "Height" },
];

const CLASS_ALLOW: Record<string, string[]> = {
  "institutional-ip": ["IMP"],
  "professional-op": ["AMB"],
  emr: ["EMER"],
  pharmacy: ["AMB", "EMER", "IMP"],
  dental: ["AMB"],
  vision: ["AMB"],
};

function add(
  missing: MissingItem[],
  code: string,
  category: string,
  stage: MissingItem["stage"],
  message: string,
  severity: MissingItem["severity"] = "error",
) {
  missing.push({ code, category, stage, message, severity });
}

export function validateClaimReadiness(b: ReadinessBundle): ValidationResult {
  const missing: MissingItem[] = [];
  const enc = b.encounter;
  const claim = b.claim;
  const claimType = String(claim?.claim_type ?? "").toLowerCase();
  const billingModel = String(claim?.billing_model ?? "");
  const isIp = billingModel === "drg_bundled" || enc?.class === "IMP";

  if (!enc) {
    add(missing, "encounter_missing", "encounter", "mds", "Encounter not found for this claim.");
  }

  // Encounter class allow-list
  const allow = CLASS_ALLOW[claimType];
  if (allow && enc && !allow.includes(enc.class)) {
    add(
      missing,
      "class_not_allowed",
      "encounter",
      "mds",
      `Encounter class ${enc.class} not allowed for claim type ${claimType} (expected ${allow.join("/")})`,
    );
  }

  // Narrative supporting info (CSI)
  const haveCats = new Set((b.supportingInfo ?? []).map((s: any) => String(s.category)));
  for (const cat of NARRATIVE_REQUIRED) {
    if (!haveCats.has(cat) && !enc?.chief_complaint && cat === "history_of_present_illness") {
      add(missing, `csi_${cat}`, "supporting_info", "mds", `Missing supporting info: ${cat.replaceAll("_", " ")}`);
    } else if (!haveCats.has(cat)) {
      add(missing, `csi_${cat}`, "supporting_info", "mds", `Missing supporting info: ${cat.replaceAll("_", " ")}`);
    }
  }

  // Chief complaint required for all claim types
  if (enc && !enc.chief_complaint) {
    add(missing, "chief_complaint", "encounter", "mds", "Chief complaint required on encounter.");
  }

  // Vitals — latest observation must include the eight readings
  const latest = (b.vitals ?? [])[0];
  if (!latest) {
    add(missing, "vitals_missing", "vitals", "mds", "No vital signs recorded for this encounter.");
  } else {
    for (const v of VITALS_REQUIRED) {
      const val = (latest as any)[v.field];
      if (val === null || val === undefined) {
        add(missing, `vital_${v.key}`, "vitals", "mds", `Missing ${v.label} on latest vitals.`);
      }
    }
  }

  // Claim-side projected supporting info (Phase 7 MDS payload, not just capture)
  if ((b.claimSupportingInfo ?? []).length === 0) {
    add(
      missing,
      "claim_si_empty",
      "supporting_info",
      "mds",
      "Claim supporting-info projection is empty — re-assemble the claim.",
      "warning",
    );
  }

  // Diagnoses
  const principals = (b.diagnoses ?? []).filter((d: any) => d.role === "principal");
  if (principals.length === 0) {
    add(missing, "pdx_missing", "diagnosis", "mds", "Exactly one principal diagnosis is required.");
  } else if (principals.length > 1) {
    add(missing, "pdx_duplicate", "diagnosis", "mds", "More than one principal diagnosis recorded.");
  }
  if (isIp) {
    for (const d of b.diagnoses ?? []) {
      if (!d.present_on_admission && !d.onset_date) {
        add(
          missing,
          "condition_onset",
          "diagnosis",
          "mds",
          `Diagnosis ${d.code} is missing condition onset (POA / onset_date).`,
        );
      }
    }
  }

  // Emergency disposition
  const cod = enc?.cause_of_death;
  const isEmer = enc?.class === "EMER";
  if ((cod === "DED" || cod === "DOA" || (isEmer && enc?.period_end))) {
    if (!b.emergency?.emergency_department_disposition) {
      add(
        missing,
        "ed_disposition",
        "emergency",
        "mds",
        "Emergency department disposition required for ED end / DED / DOA.",
      );
    }
  }

  // DRG (inpatient only)
  const drgState = {
    required: isIp,
    present: !!b.drgAssignment,
    grouper_version_ok: true,
    los_ok: true,
    achi_ok: true,
    pdx_match_ok: true,
  };

  if (isIp) {
    if (!b.drgAssignment) {
      drgState.present = false;
      add(missing, "drg_missing", "drg", "drg", "Inpatient claim requires a current DRG assignment.");
    } else {
      // Grouper version vs active ar-drg code system
      const gv = String(b.drgAssignment.drg_version ?? b.drgAssignment.grouper_version ?? "");
      if (b.arDrgVersion && gv && gv !== b.arDrgVersion) {
        drgState.grouper_version_ok = false;
        add(
          missing,
          "drg_version_mismatch",
          "drg",
          "drg",
          `DRG grouper version ${gv} does not match active ar-drg version ${b.arDrgVersion}.`,
        );
      }
      // ACHI on intervention-partition DRGs
      const partition = String(b.drg?.partition ?? "");
      const isIntervention = partition.toLowerCase().includes("intervention") || partition === "P";
      if (isIntervention) {
        const hasAchi =
          (b.chargeItems ?? []).some((c: any) => !!c.achi_code) ||
          (b.claimItems ?? []).some((c: any) =>
            String(c.service_type ?? "").toLowerCase().includes("procedure") && !!c.service_code,
          );
        if (!hasAchi) {
          drgState.achi_ok = false;
          add(
            missing,
            "drg_achi_missing",
            "drg",
            "drg",
            "Intervention-partition DRG requires at least one ACHI procedure code.",
          );
        }
      }
      // LOS within trim or outlier adjustment applied
      const los = b.hospitalization?.length_of_stay_days;
      const low = b.drg?.low_trim_los;
      const high = b.drg?.high_trim_los;
      const outOfTrim =
        typeof los === "number" &&
        ((typeof low === "number" && los < low) || (typeof high === "number" && los > high));
      if (outOfTrim) {
        const hasOutlier = (b.drgPriceAdjustments ?? []).some(
          (a: any) => a.adj_type === "low_outlier" || a.adj_type === "high_outlier",
        );
        if (!hasOutlier) {
          drgState.los_ok = false;
          add(
            missing,
            "drg_los_outlier",
            "drg",
            "drg",
            `LOS ${los} outside trim window [${low ?? "-"}, ${high ?? "-"}] and no outlier adjustment configured.`,
          );
        }
      }
      // PDx match (best-effort: drg.adrg present and a principal diagnosis exists)
      if (principals.length === 1 && b.drg?.drg_code && b.drgAssignment.drg_code && b.drg.drg_code !== b.drgAssignment.drg_code) {
        drgState.pdx_match_ok = false;
        add(
          missing,
          "drg_pdx_mismatch",
          "drg",
          "drg",
          "Assigned DRG does not match the DRG master row referenced — regroup the encounter.",
        );
      }
    }
  }

  return { ok: missing.filter((m) => m.severity === "error").length === 0, missing, drg: drgState };
}