/**
 * Phase 9 — parse NPHIES ClaimResponse / CoverageEligibilityResponse bundles.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

function toMinor(v: any): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : typeof v === "object" ? Number(v.value) : Number(v);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

function pickCategory(adj: any[], codes: string[]): any {
  for (const a of adj ?? []) {
    const codings: any[] = a?.category?.coding ?? [];
    if (codings.some((c) => codes.includes(c.code))) return a;
  }
  return null;
}

export type ParsedClaimItem = {
  sequence: number;
  payerMinor: number;
  patientMinor: number;
  netMinor: number;
  reason?: string;
};

export type ParsedClaimResponse = {
  nphiesClaimId: string | null;
  outcome: "complete" | "partial" | "error";
  status: string | null;
  disposition: string | null;
  totals: { payerMinor: number; patientMinor: number; netMinor: number };
  items: ParsedClaimItem[];
  errors: { code?: string; severity?: string; diagnostics?: string; location?: string[] }[];
};

export function parseClaimResponse(bundle: any): ParsedClaimResponse {
  const cr = (bundle?.entry ?? [])
    .map((e: any) => e?.resource)
    .find((r: any) => r?.resourceType === "ClaimResponse");
  const ops = (bundle?.entry ?? [])
    .map((e: any) => e?.resource)
    .filter((r: any) => r?.resourceType === "OperationOutcome");

  const errors = ops.flatMap((o: any) =>
    (o.issue ?? []).map((i: any) => ({
      code: i.code,
      severity: i.severity,
      diagnostics: i.diagnostics,
      location: i.location,
    })),
  );

  if (!cr) {
    return {
      nphiesClaimId: null,
      outcome: "error",
      status: null,
      disposition: null,
      totals: { payerMinor: 0, patientMinor: 0, netMinor: 0 },
      items: [],
      errors: errors.length
        ? errors
        : [{ severity: "error", diagnostics: "No ClaimResponse in bundle" }],
    };
  }

  const totalsArr = cr.total ?? [];
  const payer = pickCategory(totalsArr, ["benefit", "payerpaid"]);
  const submitted = pickCategory(totalsArr, ["submitted", "eligible"]);
  const patient = pickCategory(totalsArr, ["copay", "patientpay", "patient"]);
  const netMinor = toMinor(submitted?.amount);
  const payerMinor = toMinor(payer?.amount);
  const patientMinor = patient ? toMinor(patient.amount) : Math.max(0, netMinor - payerMinor);

  const items: ParsedClaimItem[] = (cr.item ?? []).map((it: any) => {
    const adj = it.adjudication ?? [];
    const pay = pickCategory(adj, ["benefit", "payerpaid"]);
    const elig = pickCategory(adj, ["eligible", "submitted"]);
    const pat = pickCategory(adj, ["copay", "patientpay", "patient"]);
    const lineNet = toMinor(elig?.amount);
    const linePayer = toMinor(pay?.amount);
    const linePatient = pat ? toMinor(pat.amount) : Math.max(0, lineNet - linePayer);
    const reasonCoding = (it.adjudication ?? [])
      .flatMap((a: any) => a.reason?.coding ?? [])
      .map((c: any) => c.code)
      .filter(Boolean);
    return {
      sequence: Number(it.itemSequence),
      payerMinor: linePayer,
      patientMinor: linePatient,
      netMinor: lineNet,
      reason: reasonCoding.length ? reasonCoding.join(",") : undefined,
    };
  });

  const outcomeRaw: string = cr.outcome ?? "complete";
  const outcome: ParsedClaimResponse["outcome"] =
    outcomeRaw === "complete"
      ? "complete"
      : outcomeRaw === "partial" || outcomeRaw === "queued"
      ? "partial"
      : "error";

  const nphiesClaimId =
    cr.identifier?.[0]?.value ?? cr.id ?? null;

  return {
    nphiesClaimId,
    outcome,
    status: cr.status ?? null,
    disposition: cr.disposition ?? null,
    totals: { payerMinor, patientMinor, netMinor },
    items,
    errors,
  };
}

export type ParsedEligibility = {
  active: boolean;
  inforce: boolean;
  outcome: string | null;
  errors: { code?: string; severity?: string; diagnostics?: string }[];
  raw: any;
};

export function parseEligibility(bundle: any): ParsedEligibility {
  const r = (bundle?.entry ?? [])
    .map((e: any) => e?.resource)
    .find((x: any) => x?.resourceType === "CoverageEligibilityResponse");
  const ops = (bundle?.entry ?? [])
    .map((e: any) => e?.resource)
    .filter((x: any) => x?.resourceType === "OperationOutcome");
  const errors = ops.flatMap((o: any) =>
    (o.issue ?? []).map((i: any) => ({
      code: i.code, severity: i.severity, diagnostics: i.diagnostics,
    })),
  );
  if (!r) {
    return { active: false, inforce: false, outcome: null, errors, raw: bundle };
  }
  const inforce = !!(r.insurance ?? []).some((i: any) => i.inforce);
  return {
    active: r.status === "active",
    inforce,
    outcome: r.outcome ?? null,
    errors,
    raw: r,
  };
}