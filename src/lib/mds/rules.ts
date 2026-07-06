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

function matches(cond: Record<string, unknown>, facts: RuleFacts): boolean {
  for (const [k, v] of Object.entries(cond ?? {})) {
    if ((facts as Record<string, unknown>)[k] !== v) return false;
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