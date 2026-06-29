/**
 * Phase 4 — Pricing resolver.
 *
 * resolvePrice() decides the pricing_mode for one ordered line and returns a
 * fully-populated charge_item snapshot ready for insert. Branches:
 *
 *   encounter.reimbursement_model = 'drg_bundled'  -> { drg_bundled, cost_only:true }
 *                                                     net from tenant 'cost' list,
 *                                                     patient/payer split deferred (Phase 7).
 *   active coverage  -> insured (resolves payer/network, picks payer_network list).
 *   no coverage      -> cash.
 *
 * Snapshots all multi-coded identifiers (SBS / ACHI / LOINC / GTIN / MRID) and
 * description so a later master edit cannot mutate historical charges.
 */
import { serviceClient } from "@/lib/api-clinical";
import { evaluate, loadRules, type RuleFacts } from "./rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ResolveArgs = {
  tenantId: string;
  encounterId: string;
  source: "service" | "drug";
  serviceId?: string | null;
  drugId?: string | null;
  quantity?: number;
  bodySite?: string | null;
  orderedBy?: string | null;
};

export type ResolvedCharge = {
  tenant_id: string;
  encounter_id: string;
  source_type: "service" | "drug";
  service_id: string | null;
  drug_id: string | null;
  sbs_code: string | null;
  achi_code: string | null;
  loinc_code: string | null;
  gtin: string | null;
  mrid: string | null;
  internal_code: string;
  service_type: string | null;
  description: string | null;
  quantity: number;
  unit_price_minor: number | null;
  factor: number;
  discount_minor: number;
  tax_minor: number;
  patient_share_minor: number;
  payer_share_minor: number;
  net_minor: number | null;
  currency: string;
  price_list_id: string | null;
  pricing_mode: "cash" | "insured" | "drg_bundled";
  in_network: boolean | null;
  cost_only: boolean;
  rule_trace: unknown;
  body_site: string | null;
  ordered_by: string | null;
};

async function snapshotService(db: any, serviceId: string) {
  const { data: svc } = await db.from("service_master").select("*").eq("id", serviceId).maybeSingle();
  if (!svc) return null;
  const { data: codes } = await db.from("service_code").select("code, code_system_id, is_primary_billing")
    .eq("service_id", serviceId);
  // resolve code_system slugs
  const sysIds = Array.from(new Set((codes ?? []).map((c: any) => c.code_system_id)));
  const { data: systems } = sysIds.length
    ? await db.from("code_system").select("id, slug").in("id", sysIds)
    : { data: [] as any[] };
  const slugById = new Map<string, string>((systems ?? []).map((s: any) => [s.id, (s.slug ?? "").toLowerCase()]));
  let sbs: string | null = null, achi: string | null = null, loinc: string | null = null;
  for (const c of codes ?? []) {
    const slug = slugById.get(c.code_system_id) ?? "";
    if (slug.includes("sbs")) sbs = sbs ?? c.code;
    else if (slug.includes("achi")) achi = achi ?? c.code;
    else if (slug.includes("loinc")) loinc = loinc ?? c.code;
  }
  return {
    internal_code: svc.internal_code as string,
    description: (svc.description ?? svc.name) as string,
    service_type: svc.service_type as string,
    sbs_code: sbs, achi_code: achi, loinc_code: loinc,
  };
}

async function snapshotDrug(db: any, drugId: string) {
  const { data: d } = await db.from("drug_master").select("*").eq("id", drugId).maybeSingle();
  if (!d) return null;
  return {
    internal_code: d.internal_code as string,
    description: (d.trade_name ?? d.generic_name) as string,
    service_type: "drug",
    gtin: (d.gtin ?? null) as string | null,
    mrid: (d.mrid ?? null) as string | null,
  };
}

async function pickPriceList(db: any, args: {
  tenantId: string;
  mode: "cash" | "insured" | "cost";
  payerId?: string | null;
  networkId?: string | null;
}) {
  const { tenantId, mode, payerId, networkId } = args;
  const base = db.from("price_list").select("id, currency, list_type, payer_id, network_id")
    .eq("tenant_id", tenantId).eq("active", true);
  if (mode === "cash") {
    const { data } = await base.eq("list_type", "cash").limit(1);
    return data?.[0] ?? null;
  }
  if (mode === "cost") {
    const { data } = await base.eq("list_type", "cost").limit(1);
    return data?.[0] ?? null;
  }
  // insured: payer + network -> payer-only -> cash (flag)
  if (payerId && networkId) {
    const { data } = await base.eq("list_type", "payer_network")
      .eq("payer_id", payerId).eq("network_id", networkId).limit(1);
    if (data?.[0]) return data[0];
  }
  if (payerId) {
    const { data } = await base.eq("list_type", "payer_network").eq("payer_id", payerId).limit(1);
    if (data?.[0]) return data[0];
  }
  const { data: cash } = await db.from("price_list").select("id, currency, list_type, payer_id, network_id")
    .eq("tenant_id", tenantId).eq("active", true).eq("list_type", "cash").limit(1);
  return cash?.[0] ? { ...cash[0], fallback: "cash" as const } : null;
}

export async function resolvePrice(args: ResolveArgs): Promise<ResolvedCharge> {
  const db = serviceClient() as any;
  const qty = args.quantity ?? 1;

  // 1. Encounter + coverage
  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, reimbursement_model, coverage_id, location_id")
    .eq("id", args.encounterId).maybeSingle();
  if (!enc) throw new Error("encounter_not_found");

  // 2. Snapshot the master row
  let snap: any = null;
  if (args.source === "service" && args.serviceId) snap = await snapshotService(db, args.serviceId);
  if (args.source === "drug" && args.drugId) snap = await snapshotDrug(db, args.drugId);
  if (!snap) throw new Error("master_not_found");

  // 3. Decide pricing mode
  let mode: "cash" | "insured" | "drg_bundled";
  let inNetwork: boolean | null = null;
  let payerId: string | null = null;
  let networkId: string | null = null;
  let planCopay: number | null = null;
  const traceMeta: Record<string, unknown> = {};

  if (enc.reimbursement_model === "drg_bundled") {
    mode = "drg_bundled";
  } else if (enc.coverage_id) {
    const { data: cov } = await db.from("coverage")
      .select("id, payer_id, network_id, insurance_plan_id")
      .eq("id", enc.coverage_id).maybeSingle();
    if (cov) {
      mode = "insured";
      payerId = cov.payer_id ?? null;
      networkId = cov.network_id ?? null;
      if (cov.insurance_plan_id) {
        const { data: plan } = await db.from("insurance_plan")
          .select("copay_percent").eq("id", cov.insurance_plan_id).maybeSingle();
        planCopay = (plan?.copay_percent as number | null) ?? null;
      }
      // 2-sided network check: provider's facility in patient's network?
      if (networkId && enc.location_id) {
        const { data: mem } = await db.from("network_membership")
          .select("in_network")
          .eq("network_id", networkId)
          .eq("provider_facility_id", enc.location_id)
          .maybeSingle();
        inNetwork = mem ? !!mem.in_network : false;
      } else {
        inNetwork = false;
      }
      traceMeta.network_check = { networkId, location_id: enc.location_id, in_network: inNetwork };
    } else {
      mode = "cash";
    }
  } else {
    mode = "cash";
  }

  // 4. Pick price list
  const listMode = mode === "drg_bundled" ? "cost" : mode;
  const list = await pickPriceList(db, { tenantId: args.tenantId, mode: listMode, payerId, networkId });
  let unitPrice: number | null = null;
  let factor = 1;
  let discount = 0;
  let tax = 0;
  let currency = list?.currency ?? "SAR";
  if (list) {
    const q = db.from("price_list_item").select("unit_price_minor, default_factor, tax_percent")
      .eq("price_list_id", list.id);
    if (args.source === "service") q.eq("service_id", args.serviceId!);
    else q.eq("drug_id", args.drugId!);
    const { data: pli } = await q.limit(1);
    if (pli?.[0]) {
      unitPrice = pli[0].unit_price_minor as number;
      factor = (pli[0].default_factor as number) ?? 1;
      const taxPct = pli[0].tax_percent as number | null;
      const gross = qty * unitPrice * factor;
      if (taxPct) tax = Math.round((gross - discount) * (taxPct / 100));
    }
  }
  const net = unitPrice == null ? null : Math.max(0, Math.round(qty * unitPrice * factor - discount + tax));

  // 5. Rule engine
  const facts: RuleFacts = {
    pricing_mode: mode,
    covered: mode === "insured" || mode === "drg_bundled",
    in_network: inNetwork,
    plan_copay_percent: planCopay,
  };
  const rules = await loadRules(args.tenantId);
  const outcome = evaluate(rules, facts);

  let patientShare = 0;
  let payerShare = 0;
  if (mode === "drg_bundled") {
    patientShare = 0; payerShare = 0; // deferred to claim-time DRG pricing
  } else if (net != null) {
    patientShare = Math.round((net * outcome.patient_percent) / 100);
    payerShare = net - patientShare;
  }

  return {
    tenant_id: args.tenantId,
    encounter_id: args.encounterId,
    source_type: args.source,
    service_id: args.source === "service" ? args.serviceId ?? null : null,
    drug_id: args.source === "drug" ? args.drugId ?? null : null,
    sbs_code: snap.sbs_code ?? null,
    achi_code: snap.achi_code ?? null,
    loinc_code: snap.loinc_code ?? null,
    gtin: snap.gtin ?? null,
    mrid: snap.mrid ?? null,
    internal_code: snap.internal_code,
    service_type: snap.service_type ?? null,
    description: snap.description ?? null,
    quantity: qty,
    unit_price_minor: unitPrice,
    factor,
    discount_minor: discount,
    tax_minor: tax,
    patient_share_minor: patientShare,
    payer_share_minor: payerShare,
    net_minor: net,
    currency,
    price_list_id: list?.id ?? null,
    pricing_mode: mode,
    in_network: inNetwork,
    cost_only: mode === "drg_bundled",
    rule_trace: { mode, list_fallback: list?.fallback ?? null, ...traceMeta, decisions: outcome.trace,
      preauth_required: outcome.preauth_required, plan_copay_percent: planCopay },
    body_site: args.bodySite ?? null,
    ordered_by: args.orderedBy ?? null,
  };
}