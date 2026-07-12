/**
 * Step 5 · Turn 2 — Series-referral booking (physio / dialysis / psychotherapy).
 * Requires the target service to have `service_master.sub_category='series_therapy'`
 * (debt #18 seed). Creates one referral + one accepted target + N
 * `clinic_bookings` sharing a series_id. Idempotent via source_key.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";
import { evaluateTriggers, foldTriggerOutcome } from "@/lib/mds/rules";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SeriesCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export const SeriesBody = z.object({
  origin_encounter_id: z.string().uuid(),
  service_id: z.string().uuid(),
  session_count: z.number().int().min(2).max(52),
  cadence_days: z.number().int().min(1).max(90),
  first_session_at: z.string().datetime().nullish(),
  clinic_id: z.string().uuid().nullish(),
  provider_id: z.string().uuid().nullish(),
  beneficiary_id: z.string().uuid().nullish(),
});
export type SeriesBodyT = z.infer<typeof SeriesBody>;

export async function handlePOST(args: {
  body: SeriesBodyT;
  ctx: SeriesCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const b = args.body;

  const { data: svc } = await db.from("service_master")
    .select("id, sub_category, specialty, name")
    .eq("id", b.service_id)
    .maybeSingle();
  if (!svc) return envelope("service_master not found", "service_not_found", 404);
  if ((svc as any).sub_category !== "series_therapy") {
    return envelope(
      "Service is not a pre-approved series specialty",
      "not_a_series_specialty",
      422,
      { hint: "debt #18 · catalog seed" },
    );
  }

  // Rule engine consultation (Rule C · series therapy).
  const { data: rules } = await db.from("pricing_rule")
    .select("id,name,scope,priority,condition,action,tenant_id,active")
    .or(`tenant_id.eq.${args.ctx.tenantId},tenant_id.is.null`)
    .eq("active", true)
    .order("priority", { ascending: true });
  const facts: Record<string, unknown> = {
    sub_category: (svc as any).sub_category,
    service_id: b.service_id,
    target_specialty: (svc as any).specialty ?? null,
    session_count: b.session_count,
  };
  const hits = evaluateTriggers((rules ?? []) as any[], facts, "referral");
  const decision = foldTriggerOutcome(hits, {});
  const chargeMode = (decision as any)?.charge_mode ?? "series";

  const sourceKey = `series:${b.origin_encounter_id}:${b.service_id}`;
  const { data: existing } = await db.from("referral_target")
    .select("id, referral_id")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("source_key", sourceKey)
    .limit(1);
  if (Array.isArray(existing) && existing.length > 0) {
    const refId = (existing[0] as any).referral_id;
    const { data: bookings } = await db.from("clinic_bookings")
      .select("id, series_id, appointment_at")
      .eq("tenant_id", args.ctx.tenantId)
      .eq("referral_id", refId);
    const seriesIds = new Set<string>(((bookings ?? []) as any[]).map((r: any) => r.series_id).filter(Boolean));
    return jsonData({
      ok: true,
      data: {
        referral_id: refId,
        series_id: [...seriesIds][0] ?? null,
        booking_ids: ((bookings ?? []) as any[]).map((r: any) => r.id),
        idempotent: true,
      },
    });
  }

  const { data: refIns, error: refErr } = await db.from("referral").insert({
    tenant_id: args.ctx.tenantId,
    source_encounter_id: b.origin_encounter_id,
    referral_no: `REF-S-${Date.now().toString(36).toUpperCase()}`,
    referral_class: "intra",
    status: "accepted",
    origin_source: "doctor_direct",
    charge_mode: chargeMode,
    reason: `Series therapy: ${(svc as any).name ?? b.service_id}`,
  }).select("id").single();
  if (refErr || !refIns) return envelope(refErr?.message ?? "insert failed", "db_error", 500);

  const { data: tgtIns, error: tgtErr } = await db.from("referral_target").insert({
    tenant_id: args.ctx.tenantId,
    referral_id: (refIns as any).id,
    target_kind: "specialty",
    target_specialty: (svc as any).specialty ?? null,
    target_service_id: b.service_id,
    status: "accepted",
    source_key: sourceKey,
  }).select("id").single();
  if (tgtErr || !tgtIns) return envelope(tgtErr?.message ?? "insert failed", "db_error", 500);

  const seriesId = crypto.randomUUID();
  const start = b.first_session_at ? new Date(b.first_session_at) : new Date();
  const bookings: any[] = [];
  for (let i = 0; i < b.session_count; i++) {
    const at = new Date(start.getTime());
    at.setUTCDate(at.getUTCDate() + i * b.cadence_days);
    bookings.push({
      tenant_id: args.ctx.tenantId,
      beneficiary_id: b.beneficiary_id ?? null,
      clinic_id: b.clinic_id ?? null,
      provider_id: b.provider_id ?? null,
      service_id: b.service_id,
      referral_id: (refIns as any).id,
      referral_target_id: (tgtIns as any).id,
      series_id: seriesId,
      source: "referral",
      visit_type: "series",
      appointment_at: at.toISOString(),
      status: "booked",
    });
  }
  const { data: bkIns, error: bkErr } = await db.from("clinic_bookings").insert(bookings).select("id");
  if (bkErr) return envelope(bkErr.message ?? "clinic_bookings insert failed", "db_error", 500);

  return jsonData({
    ok: true,
    data: {
      referral_id: (refIns as any).id,
      series_id: seriesId,
      booking_ids: ((bkIns ?? []) as any[]).map((r: any) => r.id),
      engine_decision: decision,
    },
  }, 201);
}

export const Route = createFileRoute("/api/clinical/v1/opd/referral/series/create")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "referral.series.create" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => SeriesBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      return handlePOST({ body: parsed.data, ctx: auth.ctx });
    },
  } },
});