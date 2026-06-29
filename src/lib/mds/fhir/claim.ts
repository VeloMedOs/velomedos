/**
 * Phase 7 — FHIR R4 Claim Bundle.
 *
 * Produces the "unified health file" payload posted to NPHIES: a transaction
 * Bundle containing Patient, Coverage, Encounter, Practitioners, Conditions,
 * Observations (supporting info), and a single Claim resource that references
 * them via internal `urn:uuid:` fullUrls.
 *
 * This is intentionally minimal — Phase 10 (validation hardening) tightens
 * coding system URIs, profile URLs, and required extensions.
 */
import type { AssembledClaim } from "@/lib/mds/claim-assembly";
import { serviceClient } from "@/lib/api-clinical";
import { beneficiaryToFhirPatient } from "./patient";
import { coverageToFhirCoverage } from "./coverage";
import { encounterToFhirEncounter } from "./encounter";

/* eslint-disable @typescript-eslint/no-explicit-any */

function urn() {
  return `urn:uuid:${crypto.randomUUID()}`;
}

export async function buildClaimBundle(claimId: string): Promise<any> {
  const db = serviceClient() as any;

  const { data: claim } = await db.from("claim").select("*").eq("id", claimId).maybeSingle();
  if (!claim) throw new Error("claim not found");

  const [
    { data: items },
    { data: diagnoses },
    { data: careTeam },
    { data: supportingInfo },
    { data: links },
  ] = await Promise.all([
    db.from("claim_item").select("*").eq("claim_id", claimId).order("sequence_no"),
    db.from("claim_diagnosis").select("*").eq("claim_id", claimId).order("sequence_no"),
    db.from("claim_care_team").select("*").eq("claim_id", claimId).order("sequence_no"),
    db.from("claim_supporting_info").select("*").eq("claim_id", claimId).order("sequence_no"),
    db.from("claim_item_link").select("*").eq("claim_id", claimId),
  ]);

  const { data: encounter } = await db
    .from("encounter")
    .select("*")
    .eq("id", claim.encounter_id)
    .maybeSingle();
  const { data: beneficiary } = await db
    .from("beneficiary")
    .select("*")
    .eq("id", encounter.beneficiary_id)
    .maybeSingle();
  const { data: coverage } = claim.coverage_id
    ? await db.from("coverage").select("*").eq("id", claim.coverage_id).maybeSingle()
    : { data: null };

  const patientUrn = urn();
  const coverageUrn = urn();
  const encounterUrn = urn();
  const claimUrn = urn();

  const entries: any[] = [];

  entries.push({
    fullUrl: patientUrn,
    resource: beneficiaryToFhirPatient(beneficiary),
    request: { method: "PUT", url: `Patient/${beneficiary.id}` },
  });

  if (coverage) {
    const { data: classes } = await db
      .from("coverage_class")
      .select("*")
      .eq("coverage_id", coverage.id);
    entries.push({
      fullUrl: coverageUrn,
      resource: coverageToFhirCoverage(coverage, classes ?? [], patientUrn),
      request: { method: "PUT", url: `Coverage/${coverage.id}` },
    });
  }

  const { data: hosp } = await db
    .from("encounter_hospitalization")
    .select("*")
    .eq("encounter_id", encounter.id)
    .maybeSingle();
  const { data: emerg } = await db
    .from("encounter_emergency")
    .select("*")
    .eq("encounter_id", encounter.id)
    .maybeSingle();
  const { data: encDx } = await db
    .from("encounter_diagnosis")
    .select("*")
    .eq("encounter_id", encounter.id);
  const { data: encCt } = await db
    .from("encounter_care_team")
    .select("*")
    .eq("encounter_id", encounter.id);

  entries.push({
    fullUrl: encounterUrn,
    resource: encounterToFhirEncounter(
      encounter,
      (encCt ?? []) as any,
      (encDx ?? []) as any,
      patientUrn,
      hosp,
      emerg,
    ),
    request: { method: "PUT", url: `Encounter/${encounter.id}` },
  });

  // Conditions
  const dxByseq = new Map<number, { urn: string; resource: any }>();
  (diagnoses ?? []).forEach((d: any) => {
    const u = urn();
    const resource = {
      resourceType: "Condition",
      subject: { reference: patientUrn },
      encounter: { reference: encounterUrn },
      code: {
        coding: [{ system: d.code_system ?? "http://hl7.org/fhir/sid/icd-10", code: d.code, display: d.display ?? undefined }],
      },
      ...(d.present_on_admission
        ? {
            extension: [
              {
                url: "http://nphies.sa/fhir/StructureDefinition/extension-pat-admission-poa",
                valueCode: d.present_on_admission,
              },
            ],
          }
        : {}),
    };
    dxByseq.set(d.sequence_no, { urn: u, resource });
    entries.push({ fullUrl: u, resource, request: { method: "POST", url: "Condition" } });
  });

  // Practitioners
  const ctByseq = new Map<number, { urn: string }>();
  (careTeam ?? []).forEach((p: any) => {
    if (!p.practitioner_user_id) return;
    const u = urn();
    entries.push({
      fullUrl: u,
      resource: {
        resourceType: "Practitioner",
        id: p.practitioner_user_id,
      },
      request: { method: "PUT", url: `Practitioner/${p.practitioner_user_id}` },
    });
    ctByseq.set(p.sequence_no, { urn: u });
  });

  // Supporting-info observations
  const siByseq = new Map<number, { urn: string }>();
  (supportingInfo ?? []).forEach((s: any) => {
    const u = urn();
    entries.push({
      fullUrl: u,
      resource: {
        resourceType: "Observation",
        status: "final",
        category: [{ text: s.category }],
        code: s.code ? { coding: [{ system: s.code_system ?? undefined, code: s.code }] } : { text: s.category },
        subject: { reference: patientUrn },
        encounter: { reference: encounterUrn },
        effectiveDateTime: s.timing,
        valueString: s.value ?? undefined,
      },
      request: { method: "POST", url: "Observation" },
    });
    siByseq.set(s.sequence_no, { urn: u });
  });

  // Claim resource
  const claimDx = (diagnoses ?? []).map((d: any) => ({
    sequence: d.sequence_no,
    diagnosisReference: { reference: dxByseq.get(d.sequence_no)!.urn },
    ...(d.role
      ? { type: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/ex-diagnosistype", code: d.role }] }] }
      : {}),
  }));

  const claimCareTeam = (careTeam ?? []).map((p: any) => ({
    sequence: p.sequence_no,
    provider: { reference: ctByseq.get(p.sequence_no)?.urn ?? `Practitioner/${p.practitioner_user_id}` },
    responsible: p.is_primary ? true : undefined,
    role: p.role
      ? { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claimcareteamrole", code: p.role }] }
      : undefined,
  }));

  const claimSI = (supportingInfo ?? []).map((s: any) => ({
    sequence: s.sequence_no,
    category: { text: s.category },
    valueReference: siByseq.get(s.sequence_no) ? { reference: siByseq.get(s.sequence_no)!.urn } : undefined,
    valueString: !siByseq.get(s.sequence_no) ? s.value ?? undefined : undefined,
    timingDateTime: s.timing ?? undefined,
  }));

  const linksByItem = new Map<number, { dx: number[]; ct: number[]; si: number[] }>();
  (links ?? []).forEach((l: any) => {
    const slot = linksByItem.get(l.item_sequence_no) ?? { dx: [], ct: [], si: [] };
    if (l.link_type === "diagnosis") slot.dx.push(l.target_sequence_no);
    if (l.link_type === "care_team") slot.ct.push(l.target_sequence_no);
    if (l.link_type === "supporting_info") slot.si.push(l.target_sequence_no);
    linksByItem.set(l.item_sequence_no, slot);
  });

  const claimItems = (items ?? []).map((i: any) => {
    const slot = linksByItem.get(i.sequence_no) ?? { dx: [], ct: [], si: [] };
    return {
      sequence: i.sequence_no,
      careTeamSequence: slot.ct.length ? slot.ct : undefined,
      diagnosisSequence: slot.dx.length ? slot.dx : undefined,
      informationSequence: slot.si.length ? slot.si : undefined,
      productOrService: {
        coding: [
          {
            system: i.is_package
              ? "http://nphies.sa/terminology/CodeSystem/ar-drg"
              : "http://nphies.sa/terminology/CodeSystem/sbs",
            code: i.service_code ?? i.non_standard_code ?? "UNSPECIFIED",
          },
        ],
        text: i.description ?? undefined,
      },
      quantity: { value: Number(i.quantity) },
      unitPrice: { value: (Number(i.unit_price_minor) || 0) / 100, currency: "SAR" },
      factor: i.factor != null ? Number(i.factor) : undefined,
      net: { value: (Number(i.net_minor) || 0) / 100, currency: "SAR" },
      bodySite: i.body_site
        ? { coding: [{ system: "http://snomed.info/sct", code: i.body_site }] }
        : undefined,
    };
  });

  const claimResource: any = {
    resourceType: "Claim",
    identifier: [
      { system: "http://nphies.sa/identifier/provider-claim", value: claim.provider_claim_no },
    ],
    status: "active",
    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: claim.claim_type }] },
    subType: { coding: [{ system: "http://nphies.sa/terminology/CodeSystem/claim-subtype", code: claim.claim_subtype }] },
    use: "claim",
    patient: { reference: patientUrn },
    created: claim.created_at,
    insurer: { display: "Payer" },
    provider: { display: "Provider" },
    priority: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/processpriority", code: "normal" }] },
    encounter: [{ reference: encounterUrn }],
    insurance: coverage
      ? [{ sequence: 1, focal: true, coverage: { reference: coverageUrn } }]
      : [],
    careTeam: claimCareTeam.length ? claimCareTeam : undefined,
    diagnosis: claimDx.length ? claimDx : undefined,
    supportingInfo: claimSI.length ? claimSI : undefined,
    item: claimItems,
    total: { value: (Number(claim.total_net_minor) || 0) / 100, currency: "SAR" },
  };

  entries.push({
    fullUrl: claimUrn,
    resource: claimResource,
    request: { method: "POST", url: "Claim" },
  });

  return {
    resourceType: "Bundle",
    type: "transaction",
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}

export type ClaimBundle = Awaited<ReturnType<typeof buildClaimBundle>>;
export type _AssembledClaim = AssembledClaim;