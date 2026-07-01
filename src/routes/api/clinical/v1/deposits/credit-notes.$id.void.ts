import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Void a credit note. Debits the wallet by the same amount + logs ERP reversal. */
const Body = z.object({ reason: z.string().min(3) });

export const Route = createFileRoute("/api/clinical/v1/deposits/credit-notes/$id/void")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "credit_note.issue" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: cn } = await db.from("credit_note").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (!cn) return envelope("Credit note not found", "not_found", 404);
      if (cn.status === "void") return envelope("Already void", "invalid_transition", 409);

      const { data: wallet } = await db.from("patient_wallet").select("id, balance_minor")
        .eq("tenant_id", auth.ctx.tenantId).eq("beneficiary_id", cn.beneficiary_id).maybeSingle();
      if (wallet && wallet.balance_minor >= cn.amount_minor) {
        await db.from("wallet_txn").insert({
          tenant_id: auth.ctx.tenantId, wallet_id: wallet.id, direction: "debit",
          source: "manual", source_ref_id: cn.id, amount_minor: cn.amount_minor,
          reason: `void_credit_note:${parsed.data.reason}`, created_by: auth.ctx.userId,
        });
      }
      const { data: updated, error } = await db.from("credit_note")
        .update({ status: "void", updated_by: auth.ctx.userId })
        .eq("id", cn.id).eq("tenant_id", auth.ctx.tenantId).select("*").maybeSingle();
      if (error) return envelope(error.message, "db_error", 400);
      await db.from("erp_posting_queue").insert({
        tenant_id: auth.ctx.tenantId, entity_type: "credit_note", entity_id: cn.id,
        payload: { action: "void", cn_no: cn.cn_no, amount_minor: cn.amount_minor, reason: parsed.data.reason },
      });
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "credit_note.void", "credit_note", cn.id, parsed.data);
      return jsonData({ data: updated });
    },
  } },
});