/**
 * Step 4 · Turn 3 — Treatment Room perform action.
 *
 * Whitelist-validates `order_item_table` (LL3: 5 polymorphic order-item
 * tables). Dispatches a status flip → 'performed'; the DB trigger
 * `order_item_perform_guard` remains the enforcer. Trigger RAISE surfaces
 * as `billed_gate` 403 to keep UI contract simple.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */

const ORDER_TABLES = [
  "lab_order_item",
  "radiology_order_item",
  "service_order_item",
  "ep_order_item",
  "prescription_item",
] as const;

const Body = z.object({
  order_item_table: z.enum(ORDER_TABLES),
  order_item_id: z.string().min(1),
});
export type RouteBody = z.infer<typeof Body>;

function isBilledGate(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("billed") || m.includes("gate") || m.includes("perform");
}

export async function handlePOST(args: { body: unknown; ctx: OpdCtx; db?: any }): Promise<Response> {
  const parsed = Body.safeParse(args.body);
  if (!parsed.success) {
    return envelope("invalid order_item_table", "validation_failed", 422, {
      allowed: ORDER_TABLES,
    });
  }
  const { order_item_table, order_item_id } = parsed.data;
  const db: any = args.db ?? serviceClient();

  const { data: row } = await db.from(order_item_table)
    .select("id, tenant_id").eq("id", order_item_id).maybeSingle();
  if (!row || (row as any).tenant_id !== args.ctx.tenantId) {
    return envelope("order item not found", "not_found", 404);
  }

  const { data: upd, error } = await db.from(order_item_table)
    .update({ status: "performed", performed_at: new Date().toISOString(), performed_by: args.ctx.userId })
    .eq("id", order_item_id).select("*").maybeSingle();
  if (error) {
    if (isBilledGate(error.message ?? "")) {
      return envelope("Order item not billed — cannot perform.", "billed_gate", 403, {
        blocked_reason: error.message,
      });
    }
    return envelope(error.message ?? "database_error", "db_error", 400);
  }

  return jsonData({ ok: true, data: { row: upd }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/treatment-room/perform")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.treatment_room.perform" });
        if (!auth.ok) return auth.res;
        let body: unknown;
        try { body = await request.json(); }
        catch { return envelope("Bad body", "bad_json", 400); }
        return handlePOST({ body, ctx: auth.ctx });
      },
    },
  },
});