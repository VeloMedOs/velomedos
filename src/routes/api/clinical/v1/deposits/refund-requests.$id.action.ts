import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import { canTransitionRefund, type RefundStatus } from "@/lib/rcm/refund-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R6 · Combined action endpoint: `POST /refund-requests/:id/approve|reject|execute|hold|release`.
 * State machine guard uses {@link canTransitionRefund}. Execute writes a `refund` txn to
 * `deposit_transaction`, which drives the balance & status projection + ERP enqueue.
 */
const Body = z.object({
  action: z.enum(["approve","reject","execute","hold","release"]),
  reason: z.string().optional(),
  approval_reason: z.string().optional(),
  approval_level: z.string().optional(),
  receipt_no: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/refund-requests/$id/action")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const capId = parsed.data.action === "execute" ? "refund.execute" : "refund.approve";
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId });
      if (!auth.ok) return auth.res;

      const db = serviceClient() as any;
      const { data: row } = await db.from("refund_request").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (!row) return envelope("Refund request not found", "not_found", 404);

      const nextStatus: Record<string, RefundStatus> = {
        approve: "approved", reject: "rejected", execute: "executed",
        hold: "held", release: "pending",
      };
      const next = nextStatus[parsed.data.action];
      if (!canTransitionRefund(row.status, next)) {
        return envelope(`Illegal transition ${row.status} → ${next}`, "invalid_transition", 409);
      }
      const now = new Date().toISOString();
      const patch: any = { status: next, updated_by: auth.ctx.userId };
      if (parsed.data.action === "approve") {
        patch.approved_by = auth.ctx.userId; patch.approved_at = now;
        patch.approval_reason = parsed.data.approval_reason ?? row.approval_reason;
        patch.approval_level = parsed.data.approval_level ?? row.approval_level;
      }
      if (parsed.data.action === "reject") { patch.rejected_at = now; }
      if (parsed.data.action === "execute") {
        patch.executed_at = now; patch.executed_by = auth.ctx.userId;
        patch.receipt_no = parsed.data.receipt_no ?? row.receipt_no;
      }
      const { data: updated, error } = await db.from("refund_request").update(patch)
        .eq("id", row.id).eq("tenant_id", auth.ctx.tenantId).select("*").maybeSingle();
      if (error) return envelope("database_error", "db_error", 400);

      // On execute, drive the balance via a `refund` txn on the source deposit.
      if (parsed.data.action === "execute") {
        await db.from("deposit_transaction").insert({
          tenant_id: auth.ctx.tenantId, deposit_id: row.deposit_id, txn_type: "refund",
          amount_minor: row.amount_minor, method: row.original_method,
          refund_request_id: row.id, receipt_no: patch.receipt_no ?? null,
          approved_by: auth.ctx.userId, created_by: auth.ctx.userId,
        });
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `refund.${parsed.data.action}`, "refund_request", row.id, parsed.data);
      return jsonData({ data: updated });
    },
  } },
});