import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Allocation = z.object({
  charge_item_id: z.string().uuid(),
  amount_minor: z.number().int().nonnegative(),
  method: z.enum(["deposit","cash","wallet"]),
  deposit_id: z.string().uuid().optional(),
  receipt_no: z.string().optional(),
  notes: z.string().optional(),
});

const Body = z.object({
  encounter_id: z.string().uuid(),
  allocations: z.array(Allocation).min(1),
});
export type CashierAllocateBody = z.infer<typeof Body>;

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * HCA-0793 · Cashier allocate — deposit / cash / wallet paths.
 *
 * - deposit: inserts `deposit_transaction` (trigger `deposit_txn_apply_ai`
 *   recomputes deposit balance + ERP enqueue). Never mutates deposit directly.
 * - cash:    inserts `cash_collection` scoped to the encounter.
 * - wallet:  resolves `patient_wallet.id`, inserts a `wallet_txn` row (source
 *   = 'apply_to_bill'), then calls `wallet_apply_txn(wallet_id, -amount)`.
 *   Never `UPDATE patient_wallet SET balance_minor`.
 */
export async function handlePOST(args: {
  body: CashierAllocateBody;
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { ctx, body } = args;

  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id")
    .eq("id", body.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  const applied: any[] = [];
  for (const a of body.allocations) {
    if (a.method === "deposit") {
      if (!a.deposit_id) return envelope("deposit_id required", "bad_body", 400);
      const { data: dep } = await db.from("deposit")
        .select("id, tenant_id, beneficiary_id, available_minor")
        .eq("id", a.deposit_id).maybeSingle();
      if (!dep || dep.tenant_id !== ctx.tenantId) return envelope("deposit not found", "not_found", 404);
      const { data: dt, error: dErr } = await db.from("deposit_transaction").insert({
        tenant_id: ctx.tenantId, deposit_id: dep.id, txn_type: "apply",
        amount_minor: a.amount_minor, method: "deposit",
        receipt_no: a.receipt_no ?? null, reason: a.notes ?? null,
        created_by: ctx.userId,
      }).select("*").single();
      if (dErr) return envelope(dErr.message, "db_error", 400);
      applied.push({ ...dt, method: "deposit", charge_item_id: a.charge_item_id });
    } else if (a.method === "cash") {
      const { data: cc, error: cErr } = await db.from("cash_collection").insert({
        tenant_id: ctx.tenantId, encounter_id: enc.id, beneficiary_id: enc.beneficiary_id,
        method: "cash", gross_minor: a.amount_minor, net_collected_minor: a.amount_minor,
        status: "posted", receipt_no: a.receipt_no ?? null, notes: a.notes ?? null,
        created_by: ctx.userId,
      }).select("*").single();
      if (cErr) return envelope(cErr.message, "db_error", 400);
      applied.push({ ...cc, method: "cash", charge_item_id: a.charge_item_id });
    } else if (a.method === "wallet") {
      const { data: w } = await db.from("patient_wallet")
        .select("id, tenant_id, balance_minor")
        .eq("beneficiary_id", enc.beneficiary_id)
        .eq("tenant_id", ctx.tenantId).maybeSingle();
      if (!w) return envelope("wallet not found for beneficiary", "not_found", 404);
      const { data: wt, error: wErr } = await db.from("wallet_txn").insert({
        tenant_id: ctx.tenantId, wallet_id: w.id, direction: "debit",
        source: "apply_to_bill", amount_minor: a.amount_minor,
        reason: a.notes ?? "cashier allocation", created_by: ctx.userId,
      }).select("*").single();
      if (wErr) return envelope(wErr.message, "db_error", 400);
      const { data: newBal, error: rpcErr } = await db.rpc("wallet_apply_txn", {
        _wallet_id: w.id, _delta_minor: -Number(a.amount_minor),
      });
      if (rpcErr) return envelope("wallet_apply_txn failed", "db_error", 500);
      applied.push({ ...wt, method: "wallet", charge_item_id: a.charge_item_id, new_balance_minor: newBal });
    }
  }

  // Post-write gate readout for UI feedback.
  const chargeIds = body.allocations.map((a) => a.charge_item_id);
  const { data: gate } = await db.from("v_order_item_gate")
    .select("charge_item_id, gate_state, reason_code")
    .in("charge_item_id", chargeIds);

  return jsonData({ ok: true, data: { applied, gate: gate ?? [] }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/cashier/allocate")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Billing — OP/ER", { capId: "opd.cashier.write" });
      if (!auth.ok) return auth.res;
      let body: CashierAllocateBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});