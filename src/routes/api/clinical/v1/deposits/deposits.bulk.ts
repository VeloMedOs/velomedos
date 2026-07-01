import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Bulk deposit actions — approve held, release hold, cancel, or repost ERP. */
const Body = z.object({
  action: z.enum(["approve","release_hold","erp_repost","cancel"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/deposits/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      for (const id of parsed.data.ids) {
        try {
          const { data: dep } = await db.from("deposit").select("*")
            .eq("id", id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
          if (!dep) { results.push({ id, ok: false, error: "not_found" }); continue; }
          if (parsed.data.action === "cancel") {
            const { error } = await db.from("deposit").update({ status: "cancelled", updated_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            if (error) throw error;
          } else if (parsed.data.action === "release_hold" || parsed.data.action === "approve") {
            if (dep.status !== "held" && dep.status !== "requested") { results.push({ id, ok: false, error: "not_held" }); continue; }
            // move to collected via a `collect` txn
            await db.from("deposit").update({ status: "collected", received_at: new Date().toISOString(), received_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            await db.from("deposit_transaction").insert({
              tenant_id: auth.ctx.tenantId, deposit_id: id, txn_type: "collect",
              amount_minor: dep.amount_minor, method: dep.method, created_by: auth.ctx.userId,
              reason: parsed.data.reason ?? null,
            });
          } else if (parsed.data.action === "erp_repost") {
            await db.from("erp_posting_queue")
              .update({ status: "pending", last_error: null })
              .eq("tenant_id", auth.ctx.tenantId).eq("entity_type", "deposit_txn").eq("status", "failed")
              .in("entity_id",
                ((await db.from("deposit_transaction").select("id").eq("deposit_id", id)).data ?? []).map((r: any) => r.id));
          }
          await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `deposit.${parsed.data.action}`, "deposit", id, { reason: parsed.data.reason });
          results.push({ id, ok: true });
        } catch (e: any) {
          results.push({ id, ok: false, error: String(e.message ?? e) });
        }
      }
      return jsonData({ data: results });
    },
  } },
});