/**
 * RCM R4 · IP / Day-Case accounting state machine.
 *
 * 23-step lifecycle spanning admission_request from clinical opening
 * through financial discharge. Encoded as an FSM with buckets for the
 * three worklists (Admission Lounge · Reception · Discharge).
 *
 * States (admission_status ⊂ + discharge_stage):
 *   requested → authorized → lounge → admitted → discharged | cancelled
 * Discharge sub-lifecycle (discharge_stage on admission):
 *   none → discharge_advice → discharge_order → medical_discharge → financial_discharge
 *
 * Blockers (surfaced to the worklists & the R3 claim scrubber for IP claims):
 *   BED_NOT_COVERED · CONSENT_MISSING · PAC_INCOMPLETE · ANESTHESIA_UNFIT
 *   AUTH_MISSING · DEPOSIT_SHORT · ORDERS_PENDING · SERIAL_NOT_GENERATED
 *   PACKAGE_MISMATCH
 */

export type AdmissionStatus =
  | "requested" | "authorized" | "lounge" | "admitted" | "discharged" | "cancelled";

export type DischargeStage =
  | "none" | "discharge_advice" | "discharge_order"
  | "medical_discharge" | "financial_discharge";

export type AdmissionBucket =
  | "requested" | "lounge" | "reception" | "in_house"
  | "discharge_advice" | "discharge_order" | "medical_discharge" | "financial_discharge"
  | "discharged" | "cancelled";

export type IpBlockerCode =
  | "BED_NOT_COVERED" | "CONSENT_MISSING" | "PAC_INCOMPLETE"
  | "ANESTHESIA_UNFIT" | "AUTH_MISSING" | "DEPOSIT_SHORT"
  | "ORDERS_PENDING" | "SERIAL_NOT_GENERATED" | "PACKAGE_MISMATCH";

export type IpBlocker = { code: IpBlockerCode; message: string; severity: "error" | "warning" };

const T: Record<AdmissionStatus, AdmissionStatus[]> = {
  requested:  ["authorized", "cancelled"],
  authorized: ["lounge", "cancelled"],
  lounge:     ["admitted", "cancelled"],
  admitted:   ["discharged", "cancelled"],
  discharged: [],
  cancelled:  [],
};

export function canTransitionAdmission(from: AdmissionStatus, to: AdmissionStatus): boolean {
  return (T[from] ?? []).includes(to);
}

const D: Record<DischargeStage, DischargeStage[]> = {
  none:                ["discharge_advice"],
  discharge_advice:    ["discharge_order"],
  discharge_order:     ["medical_discharge"],
  medical_discharge:   ["financial_discharge"],
  financial_discharge: [],
};

export function canAdvanceDischarge(from: DischargeStage, to: DischargeStage): boolean {
  return (D[from] ?? []).includes(to);
}

/** Route an admission row into its bucket for the worklists. */
export function bucketOfAdmission(row: {
  status: AdmissionStatus | string;
  discharge_stage: DischargeStage | string;
  admission_no?: string | null;
}): AdmissionBucket {
  const s = row.status as AdmissionStatus;
  if (s === "cancelled") return "cancelled";
  if (s === "discharged") return "discharged";
  if (s === "requested") return "requested";
  if (s === "authorized") return "lounge"; // lounge intake queue
  if (s === "lounge") return "reception";  // final admission gate
  // admitted → discharge sub-lifecycle
  const d = row.discharge_stage as DischargeStage;
  if (d === "financial_discharge") return "financial_discharge";
  if (d === "medical_discharge")   return "medical_discharge";
  if (d === "discharge_order")     return "discharge_order";
  if (d === "discharge_advice")    return "discharge_advice";
  return "in_house";
}

export type ReadinessCtx = {
  row: {
    status: AdmissionStatus | string;
    discharge_stage: DischargeStage | string;
    admission_no?: string | null;
    package_id?: string | null;
    room_type_entitled?: string | null;
    consent_captured_at?: string | null;
    bed_reserved_at?: string | null;
    pac_completed_at?: string | null;
    anesthesia_fit?: boolean | null;
    requested_deposit_minor?: number | null;
    paid_amount_minor?: number | null;
  };
  hasCoveredBed?: boolean;
  hasApprovedPackageAuth?: boolean;
  openOrders?: number;
};

export function readiness(ctx: ReadinessCtx): { ok: boolean; blockers: IpBlocker[] } {
  const b: IpBlocker[] = [];
  const r = ctx.row;

  const needLoungeGate = ["authorized", "lounge"].includes(String(r.status));
  const needReceptionGate = String(r.status) === "lounge";

  if (needLoungeGate) {
    if (ctx.hasCoveredBed === false) {
      b.push({ code: "BED_NOT_COVERED", severity: "error",
        message: "Requested room type is not covered by the beneficiary's insurance class." });
    }
    if (!r.consent_captured_at) {
      b.push({ code: "CONSENT_MISSING", severity: "error", message: "Consent must be captured before admission." });
    }
    if (ctx.hasApprovedPackageAuth === false) {
      b.push({ code: "AUTH_MISSING", severity: "error", message: "Package pre-authorization is not approved." });
    }
  }
  if (needReceptionGate) {
    if (!r.pac_completed_at) {
      b.push({ code: "PAC_INCOMPLETE", severity: "warning", message: "Pre-admission checklist (PAC) is incomplete." });
    }
    if (r.anesthesia_fit === false) {
      b.push({ code: "ANESTHESIA_UNFIT", severity: "error", message: "Anesthesia review returned 'unfit'." });
    }
    const req = r.requested_deposit_minor ?? 0;
    const paid = r.paid_amount_minor ?? 0;
    if (req > 0 && paid < req) {
      b.push({ code: "DEPOSIT_SHORT", severity: "warning",
        message: `Deposit paid ${paid} minor is short of requested ${req} minor.` });
    }
  }
  if (String(r.status) === "admitted" && String(r.discharge_stage) === "financial_discharge") {
    if (!r.admission_no) {
      b.push({ code: "SERIAL_NOT_GENERATED", severity: "error",
        message: "Admission serial was not generated at reception — cannot bill IP claim." });
    }
    if ((ctx.openOrders ?? 0) > 0) {
      b.push({ code: "ORDERS_PENDING", severity: "error",
        message: `${ctx.openOrders} clinical order(s) still open — close before financial discharge.` });
    }
  }
  return { ok: b.filter((x) => x.severity === "error").length === 0, blockers: b };
}

/** Human labels for buckets (worklist chips). */
export const IP_BUCKET_LABEL: Record<AdmissionBucket, string> = {
  requested:           "Requested",
  lounge:              "Lounge",
  reception:           "Reception",
  in_house:            "In-house",
  discharge_advice:    "Discharge advice",
  discharge_order:     "Discharge order",
  medical_discharge:   "Medical discharge",
  financial_discharge: "Financial discharge",
  discharged:          "Discharged",
  cancelled:           "Cancelled",
};

export const IP_BUCKET_ORDER: AdmissionBucket[] = [
  "requested", "lounge", "reception", "in_house",
  "discharge_advice", "discharge_order", "medical_discharge", "financial_discharge",
  "discharged", "cancelled",
];