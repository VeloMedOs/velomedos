/**
 * Phase 9 — minimal CoverageEligibilityRequest Bundle for NPHIES.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { serviceClient } from "@/lib/api-clinical";
import { beneficiaryToFhirPatient } from "./patient";
import { coverageToFhirCoverage } from "./coverage";

function urn() {
  return `urn:uuid:${crypto.randomUUID()}`;
}

export async function buildEligibilityBundle(claimId: string): Promise<any> {
  const db = serviceClient() as any;
  const { data: claim } = await db.from("claim").select("*").eq("id", claimId).maybeSingle();
  if (!claim) throw new Error("claim_not_found");
  if (!claim.coverage_id) throw new Error("coverage_required");

  const { data: coverage } = await db
    .from("coverage").select("*").eq("id", claim.coverage_id).maybeSingle();
  const { data: beneficiary } = await db
    .from("beneficiary").select("*").eq("id", coverage.beneficiary_id).maybeSingle();
  const { data: classes } = await db
    .from("coverage_class").select("*").eq("coverage_id", coverage.id);

  const patientUrn = urn();
  const coverageUrn = urn();
  const reqUrn = urn();

  const entries: any[] = [
    {
      fullUrl: patientUrn,
      resource: beneficiaryToFhirPatient(beneficiary),
      request: { method: "PUT", url: `Patient/${beneficiary.id}` },
    },
    {
      fullUrl: coverageUrn,
      resource: coverageToFhirCoverage(coverage, classes ?? [], patientUrn),
      request: { method: "PUT", url: `Coverage/${coverage.id}` },
    },
    {
      fullUrl: reqUrn,
      resource: {
        resourceType: "CoverageEligibilityRequest",
        status: "active",
        purpose: ["benefits", "validation"],
        patient: { reference: patientUrn },
        created: new Date().toISOString(),
        insurer: { display: "Payer" },
        provider: { display: "Provider" },
        insurance: [{ focal: true, coverage: { reference: coverageUrn } }],
      },
      request: { method: "POST", url: "CoverageEligibilityRequest" },
    },
  ];

  return {
    resourceType: "Bundle",
    type: "transaction",
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}