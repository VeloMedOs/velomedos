/**
 * RCM R2 · Authorization trigger + approval engine.
 *
 * `evaluateTriggers` runs after each order write. It answers:
 *   • does this order/prescription need pre-authorization?
 *   • which specific items triggered it, and why?
 *
 * Decision inputs (all optional — engine short-circuits if the encounter
 * is not insured):
 *   1. `service_master.preauth_required` / `drug_master.preauth_required`
 *   2. `need_approval_rule.condition` (jsonb) — payer/policy/class-scoped
 *      rules whose condition can match `service_type`, `sub_category`,
 *      `drug.atc_code`, `drug.sub_category`, `estimated_cost_minor`.
 *
 * `resolveConversion` is exported for R3/R4 to convert an approved auth's
 * `approved_quantity` and `benefit_amount_minor` into a claim_item snapshot.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { serviceClient } from "@/lib/api-clinical";

export type TriggerInputItem = {
  source: "service" | "drug";
  service_id?: string | null;
  drug_id?: string | null;
  charge_item_id?: string | null;
  quantity?: number;
  quantity_code?: string | null;
  estimated_cost_minor?: number | null;
};

export type TriggerHit = {
  index: number;
  source: "service" | "drug";
  service_id?: string | null;
  drug_id?: string | null;
  reasons: string[];
  master?: any;
};

export type TriggerResult = {
  requires_auth: boolean;
  reasons: string[];
  hits: TriggerHit[];
};

/** Fetch a coverage row to decide if the encounter is insured (skip cash). */
async function isInsured(tenantId: string, encounterId: string): Promise<{ ok: boolean; coverage?: any }> {
  const db = serviceClient() as any;
  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id, coverage_id")
    .eq("id", encounterId).maybeSingle();
  if (!enc || enc.tenant_id !== tenantId) return { ok: false };
  if (!enc.coverage_id) return { ok: false };
  const { data: cov } = await db.from("coverage")
    .select("id, payer_id, policy_id, class_id").eq("id", enc.coverage_id).maybeSingle();
  return { ok: true, coverage: cov ?? {} };
}

/** Match a single item against a rule.condition — cheap AND-style predicate. */
function conditionMatches(
  cond: Record<string, unknown>,
  ctx: { service?: any; drug?: any; item: TriggerInputItem },
): boolean {
  if (!cond || typeof cond !== "object") return false;
  for (const [k, v] of Object.entries(cond)) {
    switch (k) {
      case "service_type":
        if (!ctx.service || ctx.service.service_type !== v) return false;
        break;
      case "sub_category":
        if (!(ctx.service?.sub_category === v || ctx.drug?.sub_category === v)) return false;
        break;
      case "atc_code_prefix":
        if (!ctx.drug?.atc_code?.startsWith(String(v))) return false;
        break;
      case "min_cost_minor":
        if ((ctx.item.estimated_cost_minor ?? 0) < Number(v)) return false;
        break;
      case "min_quantity":
        if ((ctx.item.quantity ?? 0) < Number(v)) return false;
        break;
      default:
        // Unknown key → not a match (defensive). Documented in R2 acceptance notes.
        return false;
    }
  }
  return true;
}

export async function evaluateTriggers(args: {
  tenantId: string;
  encounterId: string;
  items: TriggerInputItem[];
}): Promise<TriggerResult> {
  if (!args.items?.length) return { requires_auth: false, reasons: [], hits: [] };
  const ins = await isInsured(args.tenantId, args.encounterId);
  if (!ins.ok) return { requires_auth: false, reasons: [], hits: [] };

  const db = serviceClient() as any;

  // Load referenced masters in one round-trip each.
  const serviceIds = Array.from(new Set(args.items.filter((i) => i.source === "service" && i.service_id).map((i) => i.service_id!)));
  const drugIds    = Array.from(new Set(args.items.filter((i) => i.source === "drug" && i.drug_id).map((i) => i.drug_id!)));
  const services = serviceIds.length
    ? (await db.from("service_master").select("id, service_type, sub_category, preauth_required").in("id", serviceIds)).data ?? []
    : [];
  const drugs = drugIds.length
    ? (await db.from("drug_master").select("id, atc_code, sub_category, preauth_required").in("id", drugIds)).data ?? []
    : [];
  const svcById = new Map<string, any>(services.map((s: any) => [s.id, s]));
  const drugById = new Map<string, any>(drugs.map((d: any) => [d.id, d]));

  // Fetch payer-scoped need_approval_rule rows.
  const cov = ins.coverage!;
  let rulesQ = db.from("need_approval_rule").select("*")
    .eq("tenant_id", args.tenantId).eq("active", true);
  const rules = (await rulesQ).data ?? [];
  const scoped = rules.filter((r: any) =>
    (!r.payer_id  || r.payer_id  === cov.payer_id)  &&
    (!r.policy_id || r.policy_id === cov.policy_id) &&
    (!r.class_id  || r.class_id  === cov.class_id),
  );

  const hits: TriggerHit[] = [];
  args.items.forEach((it, idx) => {
    const reasons: string[] = [];
    const service = it.source === "service" ? svcById.get(it.service_id!) : undefined;
    const drug    = it.source === "drug"    ? drugById.get(it.drug_id!)    : undefined;
    if (service?.preauth_required) reasons.push("service_flagged");
    if (drug?.preauth_required)    reasons.push("drug_flagged");
    for (const r of scoped) {
      if (conditionMatches(r.condition ?? {}, { service, drug, item: it })) {
        reasons.push(`rule:${r.scope}`);
      }
    }
    if (reasons.length) {
      hits.push({
        index: idx,
        source: it.source,
        service_id: it.service_id ?? null,
        drug_id: it.drug_id ?? null,
        reasons,
        master: service ?? drug ?? null,
      });
    }
  });

  return {
    requires_auth: hits.length > 0,
    reasons: Array.from(new Set(hits.flatMap((h) => h.reasons))),
    hits,
  };
}

/** Ensure an authorization_request exists for a triggered order, then insert the items. */
export async function ensureAuthorizationForOrder(args: {
  tenantId: string;
  encounterId: string;
  userId: string;
  hits: TriggerHit[];
  reasons: string[];
  items: TriggerInputItem[];
  chargeIds?: (string | null)[];
}): Promise<{ id: string } | null> {
  if (!args.hits.length) return null;
  const db = serviceClient() as any;
  const { data: enc } = await db.from("encounter")
    .select("id, beneficiary_id, coverage_id").eq("id", args.encounterId).maybeSingle();
  const { data: cov } = enc?.coverage_id
    ? await db.from("coverage").select("payer_id, policy_id, class_id").eq("id", enc.coverage_id).maybeSingle()
    : { data: null };
  const { data: elig } = await db.from("visit_eligibility")
    .select("id").eq("tenant_id", args.tenantId).eq("encounter_id", args.encounterId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { data: header, error } = await db.from("authorization_request").insert({
    tenant_id: args.tenantId,
    encounter_id: args.encounterId,
    beneficiary_id: enc?.beneficiary_id ?? null,
    coverage_id: enc?.coverage_id ?? null,
    eligibility_ref: elig?.id ?? null,
    payer_id: cov?.payer_id ?? null,
    policy_id: cov?.policy_id ?? null,
    class_id: cov?.class_id ?? null,
    status: "new",
    reasons_triggered: args.reasons,
    requested_by: args.userId,
    created_by: args.userId,
    updated_by: args.userId,
  }).select("id").single();
  if (error || !header) return null;

  const itemRows = args.hits.map((h) => {
    const orig = args.items[h.index];
    return {
      tenant_id: args.tenantId,
      authorization_request_id: header.id,
      source: h.source,
      service_id: h.source === "service" ? h.service_id ?? null : null,
      drug_id:    h.source === "drug"    ? h.drug_id    ?? null : null,
      charge_item_id: args.chargeIds?.[h.index] ?? null,
      quantity: orig.quantity ?? 1,
      quantity_code: orig.quantity_code ?? null,
      reason: h.reasons.join(", "),
      created_by: args.userId,
      updated_by: args.userId,
    };
  });
  if (itemRows.length) await db.from("authorization_item").insert(itemRows);
  return { id: header.id };
}

/** R3/R4 helper — resolves an approved auth item into a claim conversion. */
export function resolveConversion(item: {
  approved_quantity: number | null;
  quantity: number | null;
  benefit_amount_minor: number | null;
  decision: string | null;
}): { covered_quantity: number; covered_amount_minor: number; ratio: number } {
  const asked = Number(item.quantity ?? 0);
  const approved = Number(item.approved_quantity ?? (item.decision === "approved" ? asked : 0));
  const ratio = asked > 0 ? approved / asked : 0;
  return {
    covered_quantity: approved,
    covered_amount_minor: Number(item.benefit_amount_minor ?? 0),
    ratio,
  };
}