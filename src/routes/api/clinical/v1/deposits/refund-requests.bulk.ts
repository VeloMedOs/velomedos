import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import { canTransitionRefund, type RefundStatus } from "@/lib/rcm/refund-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Bulk refund actions — approve / reject / execute in one round-trip. */
const Body = z.object({
  action: z.enum(["approve","reject","execute"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/refund-requests/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const capId = parsed.data.action === "execute" ? "refund.execute" : "refund.approve";
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const next: Record<string, RefundStatus> = { approve: "approved", reject: "rejected", execute: "executed" };
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      for (const id of parsed.data.ids) {
        try {
          const { data: row } = await db.from("refund_request").select("*")
            .eq("id", id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
          if (!row) { results.push({ id, ok: false, error: "not_found" }); continue; }
          if (!canTransitionRefund(row.status, next[parsed.data.action])) {
            results.push({ id, ok: false, error: `invalid_transition:${row.status}` }); continue;
          }
          const now = new Date().toISOString();
          const patch: any = { status: next[parsed.data.action], updated_by: auth.ctx.userId };
          if (parsed.data.action === "approve") { patch.approved_by = auth.ctx.userId; patch.approved_at = now; patch.approval_reason = parsed.data.reason; }
          if (parsed.data.action === "reject")  { patch.rejected_at = now; }
          if (parsed.data.action === "execute") { patch.executed_by = auth.ctx.userId; patch.executed_at = now; }
          const { error } = await db.from("refund_request").update(patch).eq("id", id).eq("tenant_id", auth.ctx.tenantId);
          if (error) throw error;
          if (parsed.data.action === "execute") {
            await db.from("deposit_transaction").insert({
              tenant_id: auth.ctx.tenantId, deposit_id: row.deposit_id, txn_type: "refund",
              amount_minor: row.amount_minor, method: row.original_method,
              refund_request_id: row.id, approved_by: auth.ctx.userId, created_by: auth.ctx.userId,
            });
          }
          await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `refund.${parsed.data.action}`, "refund_request", id);
          results.push({ id, ok: true });
        } catch (e: any) {
          results.push({ id, ok: false, error: String(e.message ?? e) });
        }
      }
      return jsonData({ data: results });
    },
  } },
});