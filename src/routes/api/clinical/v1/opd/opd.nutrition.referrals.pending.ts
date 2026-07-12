/**
 * Step 4 · Turn 4 — Pending auto-generated nutrition referrals (HCA-0255).
 *
 * Filters `referral` rows where `source_key LIKE 'nutrition_screen:%'` and
 * status is still 'draft'/'submitted' (not yet acted on by the Referral
 * Cockpit in Step 5). Read-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import { z } from "zod";
import { evaluateTriggers, foldTriggerOutcome } from "@/lib/mds/rules";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handleGET(args: {
  query: { encounter_id: string | null };
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  let q = db.from("referral")
    .select("id, referral_no, source_encounter_id, beneficiary_id, status, reason, source_key, created_at")
    .eq("tenant_id", args.ctx.tenantId)
    .like("source_key", "nutrition_screen:%")
    .in("status", ["draft", "submitted"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (args.query.encounter_id) q = q.eq("source_encounter_id", args.query.encounter_id);
  const { data, error } = await q;
  if (error) return envelope(error.message ?? "database_error", "db_error", 500);
  return jsonData({ ok: true, data: { rows: data ?? [] }, request_id: crypto.randomUUID() });
}

/**
 * Step 5 · Turn 2 — Accept / decline extension.
 * Promotes an auto-generated draft nutrition referral to 'submitted' (accept)
 * or 'declined', and writes a nutrition target row on accept. `evaluateTriggers`
 * runs on the write path so Rule A/B decisions are captured.
 */
export const NutritionAcceptBody = z.object({
  referral_id: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
  notes: z.string().nullish(),
});
export type NutritionAcceptBodyT = z.infer<typeof NutritionAcceptBody>;

export async function handlePOST(args: {
  body: NutritionAcceptBodyT;
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { data: parent } = await db.from("referral")
    .select("id, tenant_id, status, source_key, source_encounter_id, source_specialty")
    .eq("id", args.body.referral_id)
    .eq("tenant_id", args.ctx.tenantId)
    .maybeSingle();
  if (!parent) return envelope("referral not found", "referral_not_found", 404);
  const sk = (parent as any).source_key as string | null;
  if (!sk || !sk.startsWith("nutrition_screen:")) {
    return envelope("Only auto-generated nutrition referrals may be actioned here", "not_a_nutrition_referral", 400);
  }
  if ((parent as any).status !== "draft") {
    return envelope(`Referral already ${(parent as any).status}`, "invalid_state", 409);
  }

  if (args.body.action === "decline") {
    const { data: upd, error } = await db.from("referral")
      .update({ status: "declined", clinical_notes: args.body.notes ?? null })
      .eq("id", args.body.referral_id)
      .select("id, status").single();
    if (error) return envelope(error.message ?? "update failed", "db_error", 500);
    return jsonData({ ok: true, data: upd });
  }

  // Accept — evaluate + promote + write target.
  const { data: rules } = await db.from("pricing_rule")
    .select("id,name,scope,priority,condition,action,tenant_id,active")
    .or(`tenant_id.eq.${args.ctx.tenantId},tenant_id.is.null`)
    .eq("active", true)
    .order("priority", { ascending: true });
  const facts = {
    target_specialty: "nutrition",
    same_specialty: false,
    target_specialty_differs: true,
  };
  const hits = evaluateTriggers((rules ?? []) as any[], facts, "referral");
  const decision = foldTriggerOutcome(hits, { target_specialty: "nutrition" });

  const { error: refErr } = await db.from("referral")
    .update({
      status: "submitted",
      origin_source: "auto_nutrition",
      charge_mode: decision.charge_mode ?? null,
      preauth_required: decision.preauth_required,
      clinical_notes: args.body.notes ?? null,
    })
    .eq("id", args.body.referral_id)
    .select("id").single();
  if (refErr) return envelope(refErr.message ?? "update failed", "db_error", 500);

  const sourceKey = `${sk}:accepted`;
  const { data: existing } = await db.from("referral_target")
    .select("id").eq("tenant_id", args.ctx.tenantId).eq("source_key", sourceKey).limit(1);
  let targetId: string;
  if (Array.isArray(existing) && existing.length > 0) {
    targetId = (existing[0] as any).id;
  } else {
    const { data: tgt, error: tgtErr } = await db.from("referral_target").insert({
      tenant_id: args.ctx.tenantId,
      referral_id: args.body.referral_id,
      target_kind: "specialty",
      target_specialty: "nutrition",
      status: "submitted",
      source_key: sourceKey,
    }).select("id").single();
    if (tgtErr || !tgt) return envelope(tgtErr?.message ?? "insert failed", "db_error", 500);
    targetId = (tgt as any).id;
  }

  return jsonData({
    ok: true,
    data: {
      referral_id: args.body.referral_id,
      target_id: targetId,
      status: "submitted",
      engine_decision: decision,
    },
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/nutrition/referrals/pending")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.nutrition.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      return handleGET({ query: { encounter_id: url.searchParams.get("encounter_id") }, ctx: auth.ctx });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.create" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => NutritionAcceptBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      return handlePOST({ body: parsed.data, ctx: auth.ctx });
    },
  } },
});