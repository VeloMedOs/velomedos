/**
 * Phase 10 — Claim readiness bundle loader.
 *
 * Pulls everything `validateClaimReadiness` + the RCM gate need in one trip,
 * scoped by tenant (the caller has already authenticated via requireTenant).
 */
import { serviceClient } from "@/lib/api-clinical";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ReadinessBundle = {
  claim: any;
  encounter: any | null;
  hospitalization: any | null;
  emergency: any | null;
  diagnoses: any[];
  vitals: any[];
  supportingInfo: any[];
  claimSupportingInfo: any[];
  drgAssignment: any | null;
  drg: any | null;
  drgPriceAdjustments: any[];
  arDrgVersion: string | null;
  chargeItems: any[];
  claimItems: any[];
  authRequests?: any[];
  authItems?: any[];
  serviceMasters?: any[];
  drugMasters?: any[];
};

export async function loadClaimReadinessBundle(
  claimId: string,
  tenantId: string,
): Promise<{ ok: true; bundle: ReadinessBundle } | { ok: false; reason: string }> {
  const db = serviceClient() as any;

  const { data: claim } = await db
    .from("claim")
    .select("*")
    .eq("id", claimId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!claim) return { ok: false, reason: "claim not found" };

  const encId = claim.encounter_id as string;

  const [enc, hosp, emer, diag, vit, csi, claimSI, dassign, ci, items] = await Promise.all([
    db.from("encounter").select("*").eq("id", encId).maybeSingle(),
    db.from("encounter_hospitalization").select("*").eq("encounter_id", encId).maybeSingle(),
    db.from("encounter_emergency").select("*").eq("encounter_id", encId).maybeSingle(),
    db.from("encounter_diagnosis").select("*").eq("encounter_id", encId),
    db.from("vitals_observation").select("*").eq("encounter_id", encId).order("recorded_at", { ascending: false }),
    db.from("clinical_supporting_info").select("*").eq("encounter_id", encId),
    db.from("claim_supporting_info").select("*").eq("claim_id", claimId),
    db.from("drg_assignment").select("*").eq("encounter_id", encId).eq("status", "assigned").order("assigned_at", { ascending: false }).limit(1),
    db.from("charge_item").select("*").eq("encounter_id", encId),
    db.from("claim_item").select("*").eq("claim_id", claimId),
  ]);

  const drgAssignment = dassign.data?.[0] ?? null;

  let drg: any | null = null;
  if (drgAssignment?.drg_id) {
    const r = await db.from("drg").select("*").eq("id", drgAssignment.drg_id).maybeSingle();
    drg = r.data ?? null;
  }

  let drgPriceAdjustments: any[] = [];
  if (drgAssignment) {
    const r = await db
      .from("drg_price_adjustment")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("active", true);
    drgPriceAdjustments = (r.data ?? []) as any[];
  }

  const csv = await db
    .from("code_system")
    .select("key, version, is_current")
    .eq("key", "ar-drg")
    .eq("is_current", true)
    .maybeSingle();

  // R2 — authorization coverage: any auth request against this encounter
  // whose items include the same service_master/drug_master ids priced into
  // the claim. Used by AUTH_MISSING in the completeness gate.
  const [ar, ai] = await Promise.all([
    db.from("authorization_request").select("*").eq("tenant_id", tenantId).eq("encounter_id", encId),
    db.from("authorization_item").select("*").eq("tenant_id", tenantId),
  ]);
  const arRows = (ar.data ?? []) as any[];
  const arIds = new Set(arRows.map((r: any) => r.id));
  const aiRows = ((ai.data ?? []) as any[]).filter((i: any) => arIds.has(i.authorization_request_id));

  // Preauth flag lookup for charged items' underlying service/drug ids.
  const svcIds = new Set<string>();
  const drugIds = new Set<string>();
  for (const c of (ci.data ?? []) as any[]) {
    if (c.service_id) svcIds.add(c.service_id);
    if (c.drug_id) drugIds.add(c.drug_id);
  }
  const [svcMasters, drugMasters] = await Promise.all([
    svcIds.size ? db.from("service_master").select("id, preauth_required").in("id", Array.from(svcIds)) : Promise.resolve({ data: [] }),
    drugIds.size ? db.from("drug_master").select("id, preauth_required").in("id", Array.from(drugIds)) : Promise.resolve({ data: [] }),
  ]);
  const arDrgVersion = (csv.data?.version as string | undefined) ?? null;

  return {
    ok: true,
    bundle: {
      claim,
      encounter: enc.data ?? null,
      hospitalization: hosp.data ?? null,
      emergency: emer.data ?? null,
      diagnoses: (diag.data ?? []) as any[],
      vitals: (vit.data ?? []) as any[],
      supportingInfo: (csi.data ?? []) as any[],
      claimSupportingInfo: (claimSI.data ?? []) as any[],
      drgAssignment,
      drg,
      drgPriceAdjustments,
      arDrgVersion,
      chargeItems: (ci.data ?? []) as any[],
      claimItems: (items.data ?? []) as any[],
      authRequests: arRows,
      authItems: aiRows,
      serviceMasters: (svcMasters as any).data ?? [],
      drugMasters: (drugMasters as any).data ?? [],
    },
  };
}