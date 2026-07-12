/**
 * Step 5 · Turn 2 — Referral create (single target).
 *
 * File 08 §B1. Runs `evaluateTriggers({scope:'referral'})` pre-write, folds
 * outcome into `charge_mode` / `preauth_required` / `discount_pct` /
 * `eligibility_check_required`, and writes ONE `referral` + ONE
 * `referral_target`. Both rows use the shipped enum `referral_status`
 * (`draft`|`submitted`|`accepted`|`declined`|`completed`|`cancelled`).
 *
 * Idempotency: `referral_target.source_key = 'doctor_direct:{enc}:{spec|prov}'`.
 * ON CONFLICT retry surfaces the existing target.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";
import { evaluateTriggers, foldTriggerOutcome } from "@/lib/mds/rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type RefCreateCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export const RefCreateBody = z.object({
  source_encounter_id: z.string().uuid(),
  target_kind: z.enum(["specialty", "encounter", "entity", "external_facility"]),
  target_encounter_type: z.enum(["ER", "IPD", "EP", "L&D", "OR"]).nullish(),
  target_specialty: z.string().min(1).nullish(),
  target_provider_id: z.string().uuid().nullish(),
  target_facility_id: z.string().uuid().nullish(),
  target_service_id: z.string().uuid().nullish(),
  reason: z.string().min(1),
  clinical_notes: z.string().nullish(),
  same_specialty: z.boolean().nullish(),
  days_since_last_visit: z.number().int().nullish(),
  sub_category: z.string().nullish(),
  dental: z.boolean().nullish(),
});
export type RefCreateBodyT = z.infer<typeof RefCreateBody>;

export async function handlePOST(args: {
  body: RefCreateBodyT;
  ctx: RefCreateCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const b = args.body;

  // 1 · Load referral-scoped rules for tenant + globals.
  const { data: rules } = await db.from("pricing_rule")
    .select("id,name,scope,priority,condition,action,tenant_id,active")
    .or(`tenant_id.eq.${args.ctx.tenantId},tenant_id.is.null`)
    .eq("active", true)
    .order("priority", { ascending: true });

  // 2 · Facts + evaluate.
  const same = b.same_specialty ?? undefined;
  const facts: Record<string, unknown> = {
    same_specialty: same,
    target_specialty_differs: same === undefined ? undefined : !same,
    target_specialty: b.target_specialty ?? null,
    days_since_last_visit: b.days_since_last_visit ?? undefined,
    sub_category: b.sub_category ?? null,
    dental: b.dental ?? undefined,
  };
  const hits = evaluateTriggers((rules ?? []) as any[], facts, "referral");
  const decision = foldTriggerOutcome(hits, {
    target_specialty: b.target_specialty ?? null,
    sub_category: b.sub_category ?? null,
  });

  // 3 · Idempotency probe — reuse existing target if source_key already there.
  const specKey = b.target_specialty ?? b.target_provider_id ?? b.target_encounter_type ?? "any";
  const sourceKey = `doctor_direct:${b.source_encounter_id}:${specKey}`;
  const { data: existing } = await db.from("referral_target")
    .select("id, referral_id, status")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("source_key", sourceKey)
    .limit(1);
  if (Array.isArray(existing) && existing.length > 0) {
    return jsonData({
      ok: true,
      data: {
        referral_id: existing[0].referral_id,
        target_id: existing[0].id,
        engine_decision: decision,
        idempotent: true,
      },
    });
  }

  // 4 · Insert referral (enum values only).
  const { data: refIns, error: refErr } = await db.from("referral").insert({
    tenant_id: args.ctx.tenantId,
    source_encounter_id: b.source_encounter_id,
    referral_no: `REF-${Date.now().toString(36).toUpperCase()}`,
    referral_class: b.target_kind === "entity" ? "inter_company"
      : b.target_kind === "external_facility" ? "external"
      : b.target_encounter_type ? "cross_encounter" : "intra",
    source_specialty: null,
    target_specialty: b.target_specialty ?? null,
    status: "draft",
    origin_source: "doctor_direct",
    charge_mode: decision.charge_mode ?? null,
    preauth_required: decision.preauth_required,
    discount_pct: decision.discount ?? null,
    reason: b.reason,
    clinical_notes: b.clinical_notes ?? null,
  }).select("id").single();
  if (refErr || !refIns) return envelope(refErr?.message ?? "insert_failed", "db_error", 500);

  // 5 · Insert single target (enum values only).
  const { data: tgtIns, error: tgtErr } = await db.from("referral_target").insert({
    tenant_id: args.ctx.tenantId,
    referral_id: (refIns as any).id,
    target_kind: b.target_kind,
    target_specialty: b.target_specialty ?? null,
    target_provider_id: b.target_provider_id ?? null,
    target_facility_id: b.target_facility_id ?? null,
    target_service_id: b.target_service_id ?? null,
    target_encounter_type: b.target_encounter_type ?? null,
    status: "draft",
    source_key: sourceKey,
  }).select("id").single();
  if (tgtErr || !tgtIns) return envelope(tgtErr?.message ?? "insert_failed", "db_error", 500);

  return jsonData({
    ok: true,
    data: {
      referral_id: (refIns as any).id,
      target_id: (tgtIns as any).id,
      engine_decision: decision,
    },
  }, 201);
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/referral/create")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.create" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => RefCreateBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      return handlePOST({ body: parsed.data, ctx: auth.ctx });
    },
  } },
});