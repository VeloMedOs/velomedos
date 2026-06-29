/**
 * Phase 7 — Claim assembly.
 *
 * Branches by encounter.reimbursement_model:
 *   • OP / ER  → itemized SBS (one claim_item per charge_item)
 *   • IP       → AR-DRG bundled single line at the priced bundle
 *
 * Snapshots all diagnosis / care-team / supporting-info rows into claim-level
 * sequenced arrays so subsequent edits to the encounter don't mutate history.
 */
import { serviceClient } from "@/lib/api-clinical";
import { priceDrg } from "./drg-pricing";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AssembleOptions = {
  providerClaimNo?: string;
  invoiceNo?: string | null;
  claimType?: string;
  actorId: string;
};

export type AssembledClaim = {
  claim: any;
  items: any[];
  diagnoses: any[];
  careTeam: any[];
  supportingInfo: any[];
  links: any[];
  pricingTrace: Record<string, unknown>;
};

function pickClaimType(serviceType: string | null | undefined): string {
  const t = (serviceType || "").toLowerCase();
  if (t.includes("pharm")) return "pharmacy";
  if (t.includes("dental") || t.includes("oral")) return "oral";
  if (t.includes("vision") || t.includes("optical")) return "vision";
  // institutional is used for IP / ER; default to professional for OP
  return "professional";
}

function pickSubtype(klass: string | null | undefined): "op" | "ip" | "emergency" {
  const c = (klass || "").toUpperCase();
  if (c === "IMP") return "ip";
  if (c === "EMER") return "emergency";
  return "op";
}

function genClaimNo(): string {
  return `CLM-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Assemble (idempotent under `force=false`): if a non-rejected claim already
 * exists for the encounter the caller receives it as-is. Use force=true to
 * supersede via `replaces_claim_id`.
 */
export async function assembleClaim(
  encounterId: string,
  opts: AssembleOptions & { force?: boolean },
): Promise<AssembledClaim> {
  const db = serviceClient() as any;

  const { data: enc, error: encErr } = await db
    .from("encounter")
    .select(
      "id, tenant_id, beneficiary_id, coverage_id, class, service_type, reimbursement_model, journey_state",
    )
    .eq("id", encounterId)
    .maybeSingle();
  if (encErr || !enc) throw new Error("encounter not found");

  const model: "itemized_sbs" | "drg_bundled" =
    enc.reimbursement_model === "drg_bundled" ? "drg_bundled" : "itemized_sbs";

  // existing active claim short-circuit
  const { data: existing } = await db
    .from("claim")
    .select("id, status")
    .eq("encounter_id", encounterId)
    .in("status", ["draft", "ready", "submitted", "accepted"])
    .maybeSingle();

  let replacesId: string | null = null;
  if (existing && !opts.force) {
    return loadClaim(existing.id);
  }
  if (existing && opts.force) {
    await db.from("claim").update({ status: "rejected" }).eq("id", existing.id);
    replacesId = existing.id;
  }

  // snapshots
  const [{ data: dxRows }, { data: ctRows }, { data: siRows }, { data: charges }] =
    await Promise.all([
      db.from("encounter_diagnosis").select("*").eq("encounter_id", encounterId).order("rank"),
      db
        .from("encounter_care_team")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("is_primary", { ascending: false }),
      db
        .from("clinical_supporting_info")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("sequence"),
      db
        .from("charge_item")
        .select("*")
        .eq("encounter_id", encounterId)
        .neq("status", "void")
        .order("created_at"),
    ]);

  // pricing
  let totalNet = 0;
  let totalPatient = 0;
  let totalPayer = 0;
  const itemsToInsert: any[] = [];
  let drgAssignmentId: string | null = null;
  let pricingTrace: Record<string, unknown> = { model };

  if (model === "drg_bundled") {
    const priced = await priceDrg(encounterId);
    totalNet = priced.net_minor;
    totalPatient = priced.patient_share_minor;
    totalPayer = priced.payer_share_minor;
    pricingTrace = { model, ...priced };
    const { data: da } = await db
      .from("drg_assignment")
      .select("id")
      .eq("encounter_id", encounterId)
      .eq("status", "assigned")
      .maybeSingle();
    drgAssignmentId = da?.id ?? null;
    itemsToInsert.push({
      sequence_no: 1,
      service_type: "drg_bundle",
      service_code: priced.drg_code,
      description: `AR-DRG ${priced.drg_code} bundle (RW ${priced.relative_weight})`,
      quantity: 1,
      unit_price_minor: priced.net_minor,
      net_minor: priced.net_minor,
      patient_share_minor: priced.patient_share_minor,
      payer_share_minor: priced.payer_share_minor,
      is_package: true,
    });
  } else {
    (charges ?? []).forEach((c: any, idx: number) => {
      const n = Number(c.net_minor) || 0;
      const p = Number(c.patient_share_minor) || 0;
      const py = Number(c.payer_share_minor) || 0;
      totalNet += n;
      totalPatient += p;
      totalPayer += py;
      itemsToInsert.push({
        sequence_no: idx + 1,
        charge_item_id: c.id,
        service_type: c.service_type,
        service_code: c.sbs_code ?? c.achi_code ?? c.loinc_code ?? c.internal_code ?? null,
        non_standard_code: c.internal_code ?? null,
        description: c.description,
        quantity: c.quantity,
        unit_price_minor: c.unit_price_minor,
        factor: c.factor,
        discount_minor: c.discount_minor,
        tax_minor: c.tax_minor,
        patient_share_minor: p,
        payer_share_minor: py,
        net_minor: n,
        body_site: c.body_site,
        cost_only: c.cost_only ?? false,
      });
    });
    pricingTrace = { model, item_count: itemsToInsert.length };
  }

  const claimType = opts.claimType ?? pickClaimType(enc.service_type);
  const subtype = pickSubtype(enc.class);

  const { data: claim, error: cErr } = await db
    .from("claim")
    .insert({
      tenant_id: enc.tenant_id,
      encounter_id: enc.id,
      coverage_id: enc.coverage_id,
      drg_assignment_id: drgAssignmentId,
      replaces_claim_id: replacesId,
      provider_claim_no: opts.providerClaimNo ?? genClaimNo(),
      invoice_no: opts.invoiceNo ?? null,
      claim_type: claimType,
      claim_subtype: subtype,
      billing_model: model,
      total_net_minor: totalNet,
      total_patient_share_minor: totalPatient,
      total_payer_share_minor: totalPayer,
      currency: "SAR",
      status: "draft",
      pricing_trace: pricingTrace,
      created_by: opts.actorId,
      updated_by: opts.actorId,
    })
    .select("*")
    .single();
  if (cErr || !claim) throw new Error(cErr?.message ?? "claim insert failed");

  // children
  const tenantId = enc.tenant_id;
  const items = itemsToInsert.map((i) => ({ ...i, tenant_id: tenantId, claim_id: claim.id }));
  const diagnoses = (dxRows ?? []).map((d: any, i: number) => ({
    tenant_id: tenantId,
    claim_id: claim.id,
    sequence_no: i + 1,
    code: d.code,
    code_system: d.code_system,
    display: d.display,
    role: d.role,
    present_on_admission: d.present_on_admission,
  }));
  const careTeam = (ctRows ?? []).map((p: any, i: number) => ({
    tenant_id: tenantId,
    claim_id: claim.id,
    sequence_no: i + 1,
    practitioner_user_id: p.practitioner_user_id,
    role: p.role,
    is_primary: p.is_primary,
  }));
  const supportingInfo = (siRows ?? []).map((s: any, i: number) => ({
    tenant_id: tenantId,
    claim_id: claim.id,
    sequence_no: i + 1,
    category: s.category,
    code: s.value_code,
    code_system: s.code_system,
    value: s.value_text,
    timing: s.recorded_at,
    source_table: "clinical_supporting_info",
    source_id: s.id,
  }));

  if (items.length) await db.from("claim_item").insert(items);
  if (diagnoses.length) await db.from("claim_diagnosis").insert(diagnoses);
  if (careTeam.length) await db.from("claim_care_team").insert(careTeam);
  if (supportingInfo.length) await db.from("claim_supporting_info").insert(supportingInfo);

  // default link: every item references the primary diagnosis if present
  const primaryDx = diagnoses.find((d: any) => d.role === "principal") ?? diagnoses[0];
  const links =
    primaryDx && items.length
      ? items.map((i) => ({
          tenant_id: tenantId,
          claim_id: claim.id,
          item_sequence_no: i.sequence_no,
          link_type: "diagnosis" as const,
          target_sequence_no: primaryDx.sequence_no,
        }))
      : [];
  if (links.length) await db.from("claim_item_link").insert(links);

  return loadClaim(claim.id);
}

export async function loadClaim(claimId: string): Promise<AssembledClaim> {
  const db = serviceClient() as any;
  const [
    { data: claim },
    { data: items },
    { data: diagnoses },
    { data: careTeam },
    { data: supportingInfo },
    { data: links },
  ] = await Promise.all([
    db.from("claim").select("*").eq("id", claimId).maybeSingle(),
    db.from("claim_item").select("*").eq("claim_id", claimId).order("sequence_no"),
    db.from("claim_diagnosis").select("*").eq("claim_id", claimId).order("sequence_no"),
    db.from("claim_care_team").select("*").eq("claim_id", claimId).order("sequence_no"),
    db.from("claim_supporting_info").select("*").eq("claim_id", claimId).order("sequence_no"),
    db.from("claim_item_link").select("*").eq("claim_id", claimId),
  ]);
  if (!claim) throw new Error("claim not found");
  return {
    claim,
    items: items ?? [],
    diagnoses: diagnoses ?? [],
    careTeam: careTeam ?? [],
    supportingInfo: supportingInfo ?? [],
    links: links ?? [],
    pricingTrace: (claim.pricing_trace as Record<string, unknown>) ?? {},
  };
}