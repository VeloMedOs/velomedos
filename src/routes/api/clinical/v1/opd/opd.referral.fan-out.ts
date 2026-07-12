/**
 * Step 5 · Turn 2 — Cross-encounter fan-out (file 08 §B2).
 *
 * One referral → many targets. Per target_kind:
 *   specialty                         → target row only (front-office to book)
 *   encounter + ER                    → encounter(class='EMER') + encounter_emergency
 *   encounter + IPD                   → admission_request
 *   encounter + EP                    → electrophysiology_order
 *   encounter + L&D                   → encounter linked to active pregnancy episode
 *   encounter + OR                    → 422 target_kind_not_ready (debt #46)
 *   external_facility                 → 403 external_blocked   (debt #22)
 *   entity                            → 400 (use inter-company route)
 *
 * Idempotency: source_key = 'cross_enc:{referral_id}:{target_encounter_type|target_specialty}'.
 * Each target + sibling row is written back-to-back; a failed sibling insert
 * unwinds the target row so the pair stays consistent (mock has no txn).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";
import { evaluateTriggers, foldTriggerOutcome } from "@/lib/mds/rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type FanOutCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export const FanOutTarget = z.object({
  target_kind: z.enum(["specialty", "encounter", "entity", "external_facility"]),
  target_encounter_type: z.enum(["ER", "IPD", "EP", "L&D", "OR"]).nullish(),
  target_specialty: z.string().nullish(),
  target_provider_id: z.string().uuid().nullish(),
  target_facility_id: z.string().uuid().nullish(),
  target_service_id: z.string().uuid().nullish(),
  notes: z.string().nullish(),
});
export const FanOutBody = z.object({
  referral_id: z.string().uuid(),
  targets: z.array(FanOutTarget).min(1).max(20),
});
export type FanOutBodyT = z.infer<typeof FanOutBody>;

type TargetResult = {
  target_kind: string;
  target_encounter_type?: string | null;
  target_id?: string;
  status?: string;
  engine_decision?: unknown;
  sibling_write?: { table: string; id: string } | null;
  admission_request_id?: string;
  awaiting?: string[];
  error?: { code: string; message: string; hint?: string };
};

export async function handlePOST(args: {
  body: FanOutBodyT;
  ctx: FanOutCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();

  // 1 · Load parent referral (tenant guard).
  const { data: parent } = await db.from("referral")
    .select("id, tenant_id, source_encounter_id, source_specialty, referral_class, beneficiary_id, status")
    .eq("id", args.body.referral_id)
    .eq("tenant_id", args.ctx.tenantId)
    .maybeSingle();
  if (!parent) return envelope("referral not found", "referral_not_found", 404);

  // 2 · Load referral rules once.
  const { data: rules } = await db.from("pricing_rule")
    .select("id,name,scope,priority,condition,action,tenant_id,active")
    .or(`tenant_id.eq.${args.ctx.tenantId},tenant_id.is.null`)
    .eq("active", true)
    .order("priority", { ascending: true });

  const results: TargetResult[] = [];

  for (const t of args.body.targets) {
    // Hard rejects — no writes.
    if (t.target_kind === "external_facility") {
      results.push({
        target_kind: t.target_kind,
        error: { code: "external_blocked", message: "External referral network not enabled", hint: "debt #22" },
      });
      continue;
    }
    if (t.target_kind === "entity") {
      results.push({
        target_kind: t.target_kind,
        error: { code: "use_inter_company_route", message: "Inter-company writes go through /opd/referral/inter-company/create" },
      });
      continue;
    }
    if (t.target_kind === "encounter" && t.target_encounter_type === "OR") {
      results.push({
        target_kind: t.target_kind,
        target_encounter_type: "OR",
        error: { code: "target_kind_not_ready", message: "OR referral target not yet available", hint: "debt #46 · Batch C_05" },
      });
      continue;
    }

    // Rule evaluation per target.
    const same = t.target_specialty && (parent as any).source_specialty
      ? (parent as any).source_specialty === t.target_specialty
      : undefined;
    const facts: Record<string, unknown> = {
      same_specialty: same,
      target_specialty_differs: same === undefined ? undefined : !same,
      target_specialty: t.target_specialty ?? null,
    };
    const hits = evaluateTriggers((rules ?? []) as any[], facts, "referral");
    const decision = foldTriggerOutcome(hits, { target_specialty: t.target_specialty ?? null });

    // Idempotency: reuse existing target on retry.
    const keyTail = t.target_encounter_type ?? t.target_specialty ?? t.target_kind;
    const sourceKey = `cross_enc:${args.body.referral_id}:${keyTail}`;
    const { data: existing } = await db.from("referral_target")
      .select("id")
      .eq("tenant_id", args.ctx.tenantId)
      .eq("source_key", sourceKey)
      .limit(1);
    if (Array.isArray(existing) && existing.length > 0) {
      results.push({
        target_kind: t.target_kind,
        target_encounter_type: t.target_encounter_type ?? null,
        target_id: (existing[0] as any).id,
        status: "draft",
        engine_decision: decision,
        sibling_write: null,
      });
      continue;
    }

    // Insert target row (submitted — dispatched to receiver).
    const wantsSibling = t.target_kind === "encounter";
    const { data: tgtIns, error: tgtErr } = await db.from("referral_target").insert({
      tenant_id: args.ctx.tenantId,
      referral_id: args.body.referral_id,
      target_kind: t.target_kind,
      target_specialty: t.target_specialty ?? null,
      target_provider_id: t.target_provider_id ?? null,
      target_facility_id: t.target_facility_id ?? null,
      target_service_id: t.target_service_id ?? null,
      target_encounter_type: t.target_encounter_type ?? null,
      status: wantsSibling ? "submitted" : "draft",
      source_key: sourceKey,
      notes: t.notes ?? null,
    }).select("id").single();
    if (tgtErr || !tgtIns) {
      results.push({
        target_kind: t.target_kind,
        error: { code: "target_insert_failed", message: tgtErr?.message ?? "insert failed" },
      });
      continue;
    }
    const targetId = (tgtIns as any).id as string;

    // Sibling write — atomicity: if it fails, unwind the target.
    let sibling: { table: string; id: string } | null = null;
    if (t.target_kind === "encounter" && t.target_encounter_type) {
      const sib = await writeSibling(db, {
        tenantId: args.ctx.tenantId,
        parent,
        target: t,
        targetId,
      });
      if (!sib.ok) {
        // Rollback the target row (best-effort; real DB uses a txn).
        await db.from("referral_target").delete().eq("id", targetId);
        results.push({
          target_kind: t.target_kind,
          target_encounter_type: t.target_encounter_type,
          error: { code: "sibling_write_failed", message: sib.message },
        });
        continue;
      }
      sibling = sib.sibling;
    }

    results.push({
      target_kind: t.target_kind,
      target_encounter_type: t.target_encounter_type ?? null,
      target_id: targetId,
      status: wantsSibling ? "submitted" : "draft",
      engine_decision: decision,
      sibling_write: sibling,
      ...(t.target_encounter_type === "IPD" && sibling
        ? { admission_request_id: sibling.id, awaiting: ["mrp", "payer", "coverage", "room_type"] }
        : {}),
    });
  }

  return jsonData({ ok: true, data: { referral_id: args.body.referral_id, targets: results } });
}

async function writeSibling(
  db: any,
  args: {
    tenantId: string;
    parent: any;
    target: z.infer<typeof FanOutTarget>;
    targetId: string;
  },
): Promise<{ ok: true; sibling: { table: string; id: string } } | { ok: false; message: string }> {
  const t = args.target;
  const parentEnc = (args.parent as any).source_encounter_id as string | null;
  const benef = (args.parent as any).beneficiary_id as string | null;

  if (t.target_encounter_type === "ER") {
    // Create encounter (class='EMER') then encounter_emergency row against it.
    const { data: enc, error: eErr } = await db.from("encounter").insert({
      tenant_id: args.tenantId,
      beneficiary_id: benef,
      class: "EMER",
      status: "planned",
      referral_target_id: args.targetId,
    }).select("id").single();
    if (eErr || !enc) return { ok: false, message: eErr?.message ?? "encounter insert failed" };
    const { data: em, error: emErr } = await db.from("encounter_emergency").insert({
      tenant_id: args.tenantId,
      encounter_id: (enc as any).id,
      triage_date: new Date().toISOString(),
    }).select("id").single();
    if (emErr || !em) {
      // Unwind encounter.
      await db.from("encounter").delete().eq("id", (enc as any).id);
      return { ok: false, message: emErr?.message ?? "encounter_emergency insert failed" };
    }
    return { ok: true, sibling: { table: "encounter_emergency", id: (em as any).id } };
  }

  if (t.target_encounter_type === "IPD") {
    if (!parentEnc) return { ok: false, message: "IPD fan-out requires source_encounter_id" };
    const { data: ar, error: arErr } = await db.from("admission_request").insert({
      tenant_id: args.tenantId,
      encounter_id: parentEnc,
      beneficiary_id: benef,
      request_type: "medical",
      referral_target_id: args.targetId,
    }).select("id").single();
    if (arErr || !ar) return { ok: false, message: arErr?.message ?? "admission_request insert failed" };
    return { ok: true, sibling: { table: "admission_request", id: (ar as any).id } };
  }

  if (t.target_encounter_type === "EP") {
    if (!parentEnc) return { ok: false, message: "EP fan-out requires source_encounter_id" };
    const { data: ep, error: epErr } = await db.from("electrophysiology_order").insert({
      tenant_id: args.tenantId,
      encounter_id: parentEnc,
      status: "requested",
      referral_target_id: args.targetId,
    }).select("id").single();
    if (epErr || !ep) return { ok: false, message: epErr?.message ?? "electrophysiology_order insert failed" };
    return { ok: true, sibling: { table: "electrophysiology_order", id: (ep as any).id } };
  }

  if (t.target_encounter_type === "L&D") {
    // Prefer existing active pregnancy episode; else open a new one.
    let episodeId: string | null = null;
    if (benef) {
      const { data: ep } = await db.from("episode_of_care")
        .select("id")
        .eq("tenant_id", args.tenantId)
        .eq("beneficiary_id", benef)
        .eq("care_type", "pregnancy")
        .eq("status", "active")
        .limit(1);
      if (Array.isArray(ep) && ep.length > 0) episodeId = (ep[0] as any).id;
    }
    if (!episodeId) {
      const { data: newEp, error: epErr } = await db.from("episode_of_care").insert({
        tenant_id: args.tenantId,
        beneficiary_id: benef,
        care_type: "pregnancy",
        status: "active",
      }).select("id").single();
      if (epErr || !newEp) return { ok: false, message: epErr?.message ?? "episode_of_care insert failed" };
      episodeId = (newEp as any).id;
    }
    const { data: enc, error: eErr } = await db.from("encounter").insert({
      tenant_id: args.tenantId,
      beneficiary_id: benef,
      class: "IMP",
      status: "planned",
      episode_of_care_id: episodeId,
      referral_target_id: args.targetId,
    }).select("id").single();
    if (eErr || !enc) return { ok: false, message: eErr?.message ?? "L&D encounter insert failed" };
    return { ok: true, sibling: { table: "encounter", id: (enc as any).id } };
  }

  return { ok: false, message: `unsupported target_encounter_type: ${t.target_encounter_type}` };
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/referral/fan-out")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "referral.fan_out" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => FanOutBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      return handlePOST({ body: parsed.data, ctx: auth.ctx });
    },
  } },
});