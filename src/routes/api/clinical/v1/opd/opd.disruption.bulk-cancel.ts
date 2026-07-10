import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import { sendBulkCancelNotification } from "@/lib/interface/sms-gateway";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

/* eslint-disable @typescript-eslint/no-explicit-any */

const Body = z.object({
  clinic_id: z.string().uuid(),
  slot_at_from: z.string().datetime(),
  slot_at_to: z.string().datetime(),
  action: z.enum(["cancel", "reschedule", "reassign"]),
  reason: z.string().min(3).max(500),
  reassign_target_clinic_id: z.string().uuid().nullable().optional(),
  cancellation_charge: z.boolean().optional(),
});
export type BulkCancelBody = z.infer<typeof Body>;
export type BulkCancelCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/**
 * HCA-0732 · Hospital-initiated bulk cancel / reschedule / reassign.
 *
 * Steps:
 *  1. Load all active bookings in the (clinic, window).
 *  2. Apply the action: cancel = status=cancelled + cancelled_at + rebook_request;
 *     reschedule = same but rebook_request=true; reassign = move to target clinic.
 *  3. Log a `clinic_disruption` row for audit.
 *  4. Fire one SMS-stub per affected booking via `sendBulkCancelNotification`.
 */
export async function handlePOST(args: {
  body: BulkCancelBody;
  ctx: BulkCancelCtx;
  db?: any;
  now?: Date;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const now = args.now ?? new Date();
  const { body, ctx } = args;

  if (body.action === "reassign" && !body.reassign_target_clinic_id) {
    return envelope("reassign_target_clinic_id required for reassign", "bad_body", 400);
  }

  const { data: clinic } = await db.from("clinics")
    .select("id, tenant_id, name").eq("id", body.clinic_id).maybeSingle();
  if (!clinic || clinic.tenant_id !== ctx.tenantId) return envelope("clinic not found", "not_found", 404);

  if (body.reassign_target_clinic_id) {
    const { data: tgt } = await db.from("clinics")
      .select("id, tenant_id").eq("id", body.reassign_target_clinic_id).maybeSingle();
    if (!tgt || tgt.tenant_id !== ctx.tenantId) return envelope("target clinic not found", "not_found", 404);
  }

  const activeStatuses = ["requested", "confirmed", "arrived"];
  const { data: bookings } = await db.from("clinic_bookings")
    .select("id, beneficiary_id, origin_encounter_id, status")
    .eq("tenant_id", ctx.tenantId).eq("clinic_id", body.clinic_id)
    .in("status", activeStatuses)
    .gte("slot_at", body.slot_at_from).lt("slot_at", body.slot_at_to);

  const rows = (bookings ?? []) as any[];

  // Apply the action row by row (mock DB has no bulk .update+.in condition semantics).
  const rebookRequest = body.action === "reschedule";
  for (const bk of rows) {
    const patch: Record<string, unknown> =
      body.action === "reassign"
        ? { clinic_id: body.reassign_target_clinic_id, status: "confirmed" }
        : { status: "cancelled", cancelled_at: now.toISOString(), rebook_request: rebookRequest };
    await db.from("clinic_bookings").update(patch).eq("id", bk.id).eq("tenant_id", ctx.tenantId);
  }

  const { data: disruption, error: dErr } = await db.from("clinic_disruption").insert({
    tenant_id: ctx.tenantId,
    clinic_id: body.clinic_id,
    slot_at_from: body.slot_at_from,
    slot_at_to: body.slot_at_to,
    reason: body.reason,
    action: body.action,
    reassign_target_clinic_id: body.reassign_target_clinic_id ?? null,
    affected_count: rows.length,
    cancellation_charge: body.cancellation_charge ?? false,
    created_by: ctx.userId,
  }).select("id").maybeSingle();
  if (dErr) return envelope("database_error", "db_error", 500, { detail: dErr.message });

  // Auto-notify each affected booking (stub — interface_log rows).
  let notified = 0;
  for (const bk of rows) {
    const { data: bene } = await db.from("beneficiary")
      .select("id, contact_number, country_code, preferred_language")
      .eq("id", bk.beneficiary_id).maybeSingle();
    const cc = (bene?.country_code as string | null) ?? "";
    const num = (bene?.contact_number as string | null) ?? "";
    await sendBulkCancelNotification({
      tenant_id: ctx.tenantId,
      phone_e164: num ? `${cc}${num}` : null,
      lang: (bene?.preferred_language === "ar" ? "ar" : "en") as "en" | "ar",
      encounter_id: bk.origin_encounter_id ?? null,
      booking_id: bk.id,
      reason: body.reason,
      action: body.action,
      rebook_request: rebookRequest,
    }, db);
    notified += 1;
  }

  return jsonData({
    ok: true,
    data: {
      disruption_id: disruption?.id ?? null,
      affected_count: rows.length,
      notifications_queued: notified,
    },
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/disruption/bulk-cancel")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "opd.disruption.write" });
      if (!auth.ok) return auth.res;
      let body: BulkCancelBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});