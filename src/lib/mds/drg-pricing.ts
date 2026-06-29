/**
 * Phase 7 — AR-DRG bundle pricing for inpatient claims.
 *
 * Looks up the applicable drg_base_rate by (payer, network, drg_version),
 * multiplies by the DRG relative weight, applies any drg_price_adjustment
 * rows ordered by priority (outliers, short-stay per-diem, ICU, same-day),
 * then splits the bundle into patient vs payer share using the coverage's
 * insurance_plan copay/deductible.
 *
 * All money values are integer halalas (minor units of SAR).
 */
import { serviceClient } from "@/lib/api-clinical";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AppliedAdjustment = {
  id: string;
  adj_type: string;
  trim_basis: string | null;
  delta_minor: number;
  reason: string;
};

export type DrgPricingResult = {
  drg_code: string;
  drg_version: string;
  relative_weight: number;
  base_rate_minor: number;
  bundle_before_adjustments_minor: number;
  net_minor: number;
  patient_share_minor: number;
  payer_share_minor: number;
  currency: string;
  applied_adjustments: AppliedAdjustment[];
  trace: Record<string, unknown>;
};

function round(n: number): number {
  return Math.round(n);
}

/**
 * Apply copay% + deductible against the payer-priced bundle.
 * deductible is consumed first, then copay% of the remainder.
 */
function splitPatientPayer(
  bundleMinor: number,
  copayPercent: number | null,
  deductibleMinor: number | null,
): { patient: number; payer: number } {
  const ded = Math.min(Math.max(deductibleMinor ?? 0, 0), bundleMinor);
  const afterDed = bundleMinor - ded;
  const copay = Math.max(Math.min(copayPercent ?? 0, 100), 0);
  const patientCopay = round((afterDed * copay) / 100);
  const patient = ded + patientCopay;
  const payer = bundleMinor - patient;
  return { patient, payer };
}

export async function priceDrg(encounterId: string): Promise<DrgPricingResult> {
  const db = serviceClient() as any;

  const { data: enc, error: encErr } = await db
    .from("encounter")
    .select("id, tenant_id, coverage_id")
    .eq("id", encounterId)
    .maybeSingle();
  if (encErr || !enc) throw new Error("encounter not found");

  const { data: drgAssign, error: daErr } = await db
    .from("drg_assignment")
    .select("id, drg_code, drg_version, drg_id")
    .eq("encounter_id", encounterId)
    .eq("status", "assigned")
    .maybeSingle();
  if (daErr || !drgAssign) throw new Error("no assigned DRG for encounter");

  let relativeWeight = 1;
  if (drgAssign.drg_id) {
    const { data: drgRef } = await db
      .from("drg")
      .select("relative_weight")
      .eq("id", drgAssign.drg_id)
      .maybeSingle();
    if (drgRef?.relative_weight != null) {
      relativeWeight = Number(drgRef.relative_weight);
    }
  }

  if (!enc.coverage_id) throw new Error("encounter has no coverage");
  const { data: cov } = await db
    .from("coverage")
    .select("id, payer_id, network_id, insurance_plan_id")
    .eq("id", enc.coverage_id)
    .maybeSingle();
  if (!cov?.payer_id) throw new Error("coverage missing payer");

  // 1. base rate (most-recent effective_from within tenant + payer + version)
  let rateQ = db
    .from("drg_base_rate")
    .select("id, base_rate_minor, currency, network_id, effective_from, effective_to")
    .eq("tenant_id", enc.tenant_id)
    .eq("payer_id", cov.payer_id)
    .eq("drg_version", drgAssign.drg_version)
    .order("effective_from", { ascending: false })
    .limit(5);
  const { data: rates } = await rateQ;
  const rate =
    (rates ?? []).find((r: any) => r.network_id === cov.network_id) ??
    (rates ?? []).find((r: any) => r.network_id == null) ??
    null;
  if (!rate) throw new Error("no DRG base rate configured for payer+version");

  const baseRate = Number(rate.base_rate_minor) || 0;
  const bundleBefore = round(baseRate * relativeWeight);

  // 2. adjustments
  const { data: hosp } = await db
    .from("encounter_hospitalization")
    .select("length_of_stay_days")
    .eq("encounter_id", encounterId)
    .maybeSingle();
  const los = hosp?.length_of_stay_days != null ? Number(hosp.length_of_stay_days) : null;

  const { data: adjustments } = await db
    .from("drg_price_adjustment")
    .select("*")
    .eq("tenant_id", enc.tenant_id)
    .eq("payer_id", cov.payer_id)
    .eq("drg_version", drgAssign.drg_version)
    .eq("active", true)
    .order("priority", { ascending: true });

  let bundle = bundleBefore;
  const applied: AppliedAdjustment[] = [];

  for (const a of (adjustments ?? []) as any[]) {
    let delta = 0;
    let fired = false;
    let reason = "";
    const threshold = a.threshold != null ? Number(a.threshold) : null;
    const marginal = a.marginal_rate != null ? Number(a.marginal_rate) : 0;
    const perDiem = a.per_diem_minor != null ? Number(a.per_diem_minor) : 0;

    if (a.adj_type === "high_outlier" && a.trim_basis === "los" && los != null && threshold != null && los > threshold) {
      const excess = los - threshold;
      delta = round(excess * perDiem * (marginal || 1));
      fired = true;
      reason = `LOS ${los}d > trim ${threshold}d`;
    } else if (a.adj_type === "low_outlier" && a.trim_basis === "los" && los != null && threshold != null && los < threshold) {
      delta = -round((threshold - los) * perDiem);
      fired = true;
      reason = `LOS ${los}d < trim ${threshold}d`;
    } else if (a.adj_type === "short_stay_per_diem" && los != null) {
      delta = round(los * perDiem) - bundle;
      fired = true;
      reason = `short-stay per-diem ${los}d`;
    } else if (a.adj_type === "same_day" && los != null && los <= 1) {
      delta = round(bundle * (marginal || 0));
      fired = true;
      reason = `same-day adjustment`;
    } else if (a.adj_type === "icu_addon") {
      delta = round(baseRate * (marginal || 0));
      fired = true;
      reason = `ICU add-on`;
    }

    if (fired) {
      bundle = Math.max(0, bundle + delta);
      applied.push({
        id: a.id,
        adj_type: a.adj_type,
        trim_basis: a.trim_basis ?? null,
        delta_minor: delta,
        reason,
      });
    }
  }

  // 3. patient/payer split via plan copay/deductible
  let copay: number | null = null;
  let deductible: number | null = null;
  if (cov.insurance_plan_id) {
    const { data: plan } = await db
      .from("insurance_plan")
      .select("copay_percent, deductible_minor")
      .eq("id", cov.insurance_plan_id)
      .maybeSingle();
    copay = plan?.copay_percent != null ? Number(plan.copay_percent) : null;
    deductible = plan?.deductible_minor != null ? Number(plan.deductible_minor) : null;
  }
  const split = splitPatientPayer(bundle, copay, deductible);

  return {
    drg_code: drgAssign.drg_code,
    drg_version: drgAssign.drg_version,
    relative_weight: relativeWeight,
    base_rate_minor: baseRate,
    bundle_before_adjustments_minor: bundleBefore,
    net_minor: bundle,
    patient_share_minor: split.patient,
    payer_share_minor: split.payer,
    currency: rate.currency ?? "SAR",
    applied_adjustments: applied,
    trace: {
      drg_assignment_id: drgAssign.id,
      base_rate_id: rate.id,
      coverage_id: cov.id,
      payer_id: cov.payer_id,
      network_id: cov.network_id,
      copay_percent: copay,
      deductible_minor: deductible,
      length_of_stay_days: los,
    },
  };
}