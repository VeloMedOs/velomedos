/**
 * Step 5 · Turn 1 — Referral Cockpit read (file 08 §C1, file 20 addendum).
 *
 * Consumes existing `referral` + `referral_target` tables. Emits per-target
 * rule-engine decision snapshot from `evaluateTriggers({scope:'referral'})`
 * using existing `pricing_rule` rows already loaded through loadRules().
 *
 * Read-only; no writes. Filters: class, status, from/to.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";
import { evaluateTriggers, foldTriggerOutcome } from "@/lib/mds/rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CockpitCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export type CockpitQuery = {
  referral_class: string | null;
  status: string | null;
  from: string | null;
  to: string | null;
  limit: number;
};

function parseFacts(r: any): Record<string, unknown> {
  const sameSpecialty =
    r.source_specialty && r.target_specialty
      ? r.source_specialty === r.target_specialty
      : undefined;
  return {
    referral_class: r.referral_class,
    source_specialty: r.source_specialty,
    target_specialty: r.target_specialty ?? null,
    same_specialty: sameSpecialty,
    target_specialty_differs: sameSpecialty === undefined ? undefined : !sameSpecialty,
    days_since_last_visit: r.days_since_original ?? undefined,
    sub_category: r.sub_category ?? null,
  };
}

export async function handleGET(args: {
  query: CockpitQuery;
  ctx: CockpitCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();

  // 1 · Referrals for this tenant (with filters).
  let q = db.from("referral")
    .select("id, referral_no, source_encounter_id, source_specialty, referral_class, charge_mode, status, reason, source_key, discount_pct, preauth_required, priority, created_at")
    .eq("tenant_id", args.ctx.tenantId);
  if (args.query.referral_class) q = q.eq("referral_class", args.query.referral_class);
  if (args.query.status) q = q.eq("status", args.query.status);
  if (args.query.from) q = q.gte("created_at", args.query.from);
  if (args.query.to) q = q.lte("created_at", args.query.to);
  q = q.order("created_at", { ascending: false }).limit(args.query.limit);
  const { data: referrals, error } = await q;
  if (error) return envelope(error.message ?? "database_error", "db_error", 500);

  const list = (referrals ?? []) as any[];
  const ids = list.map((r) => r.id);

  // 2 · Targets (single fetch, grouped in memory).
  const targetsById: Record<string, any[]> = {};
  if (ids.length) {
    const { data: targets } = await db.from("referral_target")
      .select("id, referral_id, target_kind, target_specialty, target_provider_id, target_facility_id, target_service_id, status, booked_appointment_id, notes")
      .in("referral_id", ids);
    for (const t of (targets ?? []) as any[]) {
      (targetsById[t.referral_id] ||= []).push(t);
    }
  }

  // 3 · Rule engine decision per referral (pure evaluation, no writes).
  const { data: rules } = await db.from("pricing_rule")
    .select("id,name,scope,priority,condition,action,tenant_id,active")
    .or(`tenant_id.eq.${args.ctx.tenantId},tenant_id.is.null`)
    .eq("active", true)
    .order("priority", { ascending: true });

  const rows = list.map((r) => {
    const facts = parseFacts(r);
    const hits = evaluateTriggers((rules ?? []) as any[], facts, "referral");
    const decision = foldTriggerOutcome(hits, { target_specialty: r.target_specialty ?? null, sub_category: (facts.sub_category as string) ?? null });
    return {
      ...r,
      targets: targetsById[r.id] ?? [],
      rule_decision: decision,
      auto_generated: typeof r.source_key === "string" && r.source_key.length > 0,
    };
  });

  return jsonData({ ok: true, data: rows, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/referral/cockpit")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.cockpit.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const q: CockpitQuery = {
        referral_class: url.searchParams.get("referral_class"),
        status: url.searchParams.get("status"),
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
        limit: Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 500),
      };
      return handleGET({ query: q, ctx: auth.ctx });
    },
  } },
});