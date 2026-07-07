/**
 * Phase 4 — Pricing rule engine.
 *
 * Loads tenant-owned rules + global defaults (tenant_id IS NULL), filters by scope
 * and evaluates them deterministically in priority order. Each evaluation step is
 * pushed into `trace` so the calling resolver can persist a full rule_trace on the
 * charge_item.
 *
 * Conditions are JSON shaped like { "pricing_mode": "insured", "covered": true } —
 * a simple equality match. Actions are JSON read by `applyAction`.
 */
import { serviceClient } from "@/lib/api-clinical";

export type RuleScope =
  | "eligibility" | "share" | "package" | "substitution" | "drg_outlier"
  | "out_of_network" | "referral" | "pbm";

export type RuleFacts = {
  pricing_mode: "cash" | "insured" | "drg_bundled";
  covered: boolean;
  in_network: boolean | null;
  plan_copay_percent?: number | null;
  /* --- Step 3 referral additions (AA3 · all optional; other-scope callers unaffected) --- */
  referral_class?: "intra" | "inter_company" | "external" | "cross_encounter";
  source_specialty?: string;
  target_specialty?: string;
  target_specialty_differs?: boolean;
  days_since_last_visit?: number;
  service_id?: string;
  sub_category?: string;
  coverage_id?: string;
  category?: string;
  overbook?: boolean;
};

export type RuleOutcome = {
  patient_percent: number; // 0..100 of net assigned to patient
  preauth_required: boolean;
  trace: Array<{ rule_id: string; name: string; scope: string; matched: boolean; action?: unknown }>;
};

type Rule = {
  id: string; name: string; scope: RuleScope; priority: number;
  condition: Record<string, unknown>; action: Record<string, unknown>;
  tenant_id: string | null; active: boolean;
};

/**
 * Step 3 · AA2 — matches() supports flat equality AND {op, value} operator shapes.
 * Backward-compat: any existing rule payload using flat equality is unchanged.
 * Operator shapes: {op:'lte'|'gte'|'lt'|'gt'|'in', value: number|unknown[]}.
 * Fails closed when a rule references a fact key the caller did not populate.
 */
function matches(cond: Record<string, unknown>, facts: RuleFacts): boolean {
  for (const [k, v] of Object.entries(cond ?? {})) {
    const factVal = (facts as Record<string, unknown>)[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v) && "op" in (v as object)) {
      const { op, value } = v as { op: string; value: unknown };
      switch (op) {
        case "lte":
          if (!(typeof factVal === "number" && factVal <= (value as number))) return false;
          break;
        case "gte":
          if (!(typeof factVal === "number" && factVal >= (value as number))) return false;
          break;
        case "lt":
          if (!(typeof factVal === "number" && factVal < (value as number))) return false;
          break;
        case "gt":
          if (!(typeof factVal === "number" && factVal > (value as number))) return false;
          break;
        case "in":
          if (!(Array.isArray(value) && (value as unknown[]).includes(factVal))) return false;
          break;
        default:
          return false;
      }
    } else if (factVal !== v) {
      return false;
    }
  }
  return true;
}

export async function loadRules(tenantId: string): Promise<Rule[]> {
  const db = serviceClient();
  const { data } = await db
    .from("pricing_rule")
    .select("id,name,scope,priority,condition,action,tenant_id,active")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .eq("active", true)
    .order("priority", { ascending: true });
  return (data ?? []) as unknown as Rule[];
}

/**
 * Evaluate rules in priority order; first match per category wins.
 * Default: 0% patient (fully covered by payer) unless rules say otherwise.
 */
export function evaluate(rules: Rule[], facts: RuleFacts): RuleOutcome {
  const trace: RuleOutcome["trace"] = [];
  let patient_percent = 0;
  let preauth_required = false;
  let shareDecided = false;

  for (const r of rules) {
    // Filter relevant scopes
    if (!["eligibility", "share", "out_of_network"].includes(r.scope)) continue;
    const m = matches(r.condition, facts);
    trace.push({ rule_id: r.id, name: r.name, scope: r.scope, matched: m, action: m ? r.action : undefined });
    if (!m) continue;
    const a = r.action ?? {};
    if (typeof a.patient_percent === "number" && !shareDecided) {
      patient_percent = a.patient_percent as number;
      shareDecided = true;
    }
    if (a.use_plan_copay === true && !shareDecided && typeof facts.plan_copay_percent === "number") {
      patient_percent = facts.plan_copay_percent ?? 0;
      shareDecided = true;
    }
    if (a.preauth_required === true) preauth_required = true;
  }

  // Cash always defaults to 100% patient if no rule decided
  if (!shareDecided && facts.pricing_mode === "cash") patient_percent = 100;

  return { patient_percent, preauth_required, trace };
}

/* ---------------------------------------------------------------------------
 * Step 1 · Trigger evaluator for non-share scopes (referral, pbm).
 * evaluate() intentionally keeps its share/eligibility signature untouched;
 * evaluateTriggers() is the extension point for gate-adjacent rules that
 * only need to know which triggers fired and with what payload.
 * ------------------------------------------------------------------------- */
export type TriggerScope = Extract<RuleScope, "referral" | "pbm">;

export type TriggerHit = {
  rule_id: string;
  name: string;
  scope: TriggerScope;
  priority: number;
  action: Record<string, unknown>;
  /** Convenience: the `code` string most rule actions carry. */
  code?: string;
};

export function evaluateTriggers(
  rules: Rule[],
  facts: Record<string, unknown>,
  scope: TriggerScope,
): TriggerHit[] {
  const hits: TriggerHit[] = [];
  for (const r of rules) {
    if (r.scope !== scope) continue;
    if (!matches(r.condition ?? {}, facts as unknown as RuleFacts)) continue;
    const action = (r.action ?? {}) as Record<string, unknown>;
    hits.push({
      rule_id: r.id,
      name: r.name,
      scope,
      priority: r.priority,
      action,
      code: typeof action.code === "string" ? action.code : undefined,
    });
  }
  return hits;
}

/* ---------------------------------------------------------------------------
 * foldTriggerOutcome — collapses TriggerHit[] into the Addendum 1-A contract
 * consumed by Step 3/5 hooks. Pure: no config lookups, no side effects.
 *
 * Notes:
 *  - Rule E (overbook) carries `alert_only`; block_reason stays null inside
 *    the fold. The caller enforces the hard cap by reading the configured
 *    `overbook_limit` and setting the reason itself.
 *  - Rule C carries `charge_mode_resolver: 'series_or_no_charge'` — resolved
 *    to 'series' when the caller-supplied `target_specialty` is in
 *    action.series_specialties, else 'no_charge'.
 * ------------------------------------------------------------------------- */
export type TriggerOutcome = {
  preauth_required: boolean;
  charge_mode: "new_consult" | "follow_up" | "series" | "no_charge" | null;
  discount: number | null;
  eligibility_check_required: boolean;
  block_reason: string | null;
};

const CHARGE_MODES = new Set(["new_consult", "follow_up", "series", "no_charge"]);

export function foldTriggerOutcome(
  hits: TriggerHit[],
  facts?: { target_specialty?: string | null; sub_category?: string | null },
): TriggerOutcome {
  const sorted = [...hits].sort((a, b) => a.priority - b.priority);

  let preauth_required = false;
  let charge_mode: TriggerOutcome["charge_mode"] = null;
  let discount: number | null = null;
  let eligibility_check_required = false;
  let block_reason: string | null = null;

  for (const h of sorted) {
    const a = h.action ?? {};
    if (a.preauth_required === true) preauth_required = true;
    if (a.eligibility_check_required === true) eligibility_check_required = true;
    if (charge_mode === null) {
      if (typeof a.charge_mode === "string" && CHARGE_MODES.has(a.charge_mode)) {
        charge_mode = a.charge_mode as TriggerOutcome["charge_mode"];
      } else if (a.charge_mode_resolver === "series_or_no_charge") {
        // BB2 · Rule C series branch keys off service_master.sub_category
        // (populated by Batch-C service catalog), not a hard-coded specialty list.
        const flag =
          typeof a.series_sub_category === "string"
            ? (a.series_sub_category as string)
            : "series_therapy";
        charge_mode = facts?.sub_category === flag ? "series" : "no_charge";
      }
    }
    if (discount === null && typeof a.discount === "number") {
      discount = a.discount;
    }
    if (block_reason === null && a.block === true) {
      block_reason = typeof a.code === "string" ? a.code : (h.name || "blocked");
    }
  }

  return { preauth_required, charge_mode, discount, eligibility_check_required, block_reason };
}