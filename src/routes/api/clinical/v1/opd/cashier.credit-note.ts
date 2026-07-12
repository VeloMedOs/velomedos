import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Body = z.object({
  encounter_id: z.string().uuid(),
  charge_item_ids: z.array(z.string().uuid()).min(1),
  reason: z.string().min(3),
});
export type CreditNoteBody = z.infer<typeof Body>;

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

/** KK2 — consultation lock derivation. */
async function consultationLocked(db: any, encounterId: string): Promise<boolean> {
  const { data: enc } = await db.from("encounter").select("journey_state").eq("id", encounterId).maybeSingle();
  if ((enc as any)?.journey_state === "clinically_documented") return true;
  const { data: bks } = await db.from("clinic_bookings")
    .select("status").eq("origin_encounter_id", encounterId).eq("status", "in_consult").limit(1);
  return ((bks as any[]) ?? []).length > 0;
}

async function isUnperformed(db: any, table: string, id: string): Promise<boolean> {
  if (table === "prescription_item") {
    const { data } = await db.from(table).select("dispense_status").eq("id", id).maybeSingle();
    return (data as any)?.dispense_status !== "dispensed";
  }
  const { data } = await db.from(table).select("status").eq("id", id).maybeSingle();
  const st = (data as any)?.status;
  return !st || st === "ordered";
}

export async function handlePOST(args: { body: CreditNoteBody; ctx: OpdCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { body, ctx } = args;

  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id")
    .eq("id", body.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  const locked = await consultationLocked(db, enc.id);
  const results: any[] = [];
  for (const chargeId of body.charge_item_ids) {
    const { data: charge } = await db.from("charge_item")
      .select("id, tenant_id, encounter_id, service_id, order_item_table, order_item_id, patient_share_minor, net_minor, status")
      .eq("id", chargeId).maybeSingle();
    if (!charge || charge.tenant_id !== ctx.tenantId) return envelope("charge not found", "not_found", 404);
    if (charge.status === "cancelled") continue;

    if (charge.order_item_table && charge.order_item_id) {
      const unperformed = await isUnperformed(db, charge.order_item_table, charge.order_item_id);
      if (!unperformed) return envelope("order item already performed", "item_already_performed", 422, { charge_item_id: chargeId });
    }

    let isConsultationFee = false;
    if (charge.service_id) {
      const { data: sm } = await db.from("service_master")
        .select("service_type, internal_code").eq("id", charge.service_id).maybeSingle();
      const t = String((sm as any)?.service_type ?? "").toLowerCase();
      const code = String((sm as any)?.internal_code ?? "").toLowerCase();
      isConsultationFee = t.includes("consult") || code.includes("consult");
    }
    if (isConsultationFee && locked) {
      return envelope("consultation fee is locked (visit in consult)", "consultation_locked", 409, { charge_item_id: chargeId });
    }

    const copay = Math.max(Number(charge.patient_share_minor ?? 0), 0);
    const { data: cn, error: cnErr } = await db.from("credit_note").insert({
      tenant_id: ctx.tenantId, beneficiary_id: enc.beneficiary_id, encounter_id: enc.id,
      amount_minor: copay, reason: body.reason, status: "issued",
      source_charge_ref: chargeId, created_by: ctx.userId, updated_by: ctx.userId,
    }).select("*").single();
    if (cnErr) return envelope(cnErr.message, "db_error", 400);

    let walletDelta: any = null;
    if (copay > 0) {
      const { data: w } = await db.from("patient_wallet")
        .select("id").eq("tenant_id", ctx.tenantId).eq("beneficiary_id", enc.beneficiary_id).maybeSingle();
      if ((w as any)?.id) {
        await db.from("wallet_txn").insert({
          tenant_id: ctx.tenantId, wallet_id: (w as any).id, direction: "credit",
          source: "credit_note", source_ref_id: (cn as any).id,
          amount_minor: copay, reason: body.reason, created_by: ctx.userId,
        });
        const { data: bal } = await db.rpc("wallet_apply_txn", { _wallet_id: (w as any).id, _delta_minor: copay });
        walletDelta = bal;
      }
    }

    await db.from("charge_item").update({ status: "cancelled" }).eq("id", chargeId);
    if (charge.order_item_table && charge.order_item_id) {
      const patch = charge.order_item_table === "prescription_item"
        ? { dispense_status: "cancelled" }
        : { status: "cancelled" };
      await db.from(charge.order_item_table).update(patch).eq("id", charge.order_item_id);
    }

    const { data: aItems } = await db.from("authorization_item")
      .select("id, authorization_request_id").eq("charge_item_id", chargeId).limit(1);
    const aItem = (aItems as any[])?.[0];
    if (aItem?.authorization_request_id) {
      await db.from("authorization_request")
        .update({ status: "cancelled", updated_by: ctx.userId })
        .eq("id", aItem.authorization_request_id);
    }

    results.push({ charge_item_id: chargeId, credit_note: cn, wallet_balance_minor: walletDelta });
  }

  return jsonData({ ok: true, data: { results }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/cashier/credit-note")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Billing — OP/ER", { capId: "opd.cashier.write" });
      if (!auth.ok) return auth.res;
      let body: CreditNoteBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});