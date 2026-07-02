import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";
import { requiredMethodFields, canTransitionCash, type CashMethod } from "@/lib/rcm/cash-collection-sm";
import { logCall } from "@/lib/rcm/interface-registry";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R7 · Post a draft cash collection.
 *
 *   1. re-validate method details
 *   2. require an open session for cash/POS
 *   3. queue ZATCA (via interface_log)
 *   4. queue D365 ERP posting (via erp_posting_queue)
 *   5. write cash_session_txn (direction=in)
 *   6. set status=posted, receipt_no, posted_at
 */
export const Route = createFileRoute("/api/clinical/v1/cash/collections/$id/post")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.post" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: row, error: e0 } = await db.from("cash_collection").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (e0 || !row) return envelope("Collection not found", "not_found", 404);
      if (!canTransitionCash(row.status, "posted")) return envelope(`Cannot post from ${row.status}`, "invalid_state", 409);

      // Re-validate method details
      const req = requiredMethodFields(row.method as CashMethod);
      const detail: Record<string, unknown> = {
        pos_ref: row.pos_ref, bank_ref: row.bank_ref, cheque_no: row.cheque_no,
        cheque_date: row.cheque_date, online_ref: row.online_ref,
      };
      const missing = req.filter((k) => !detail[k]);
      if (missing.length) return envelope(`Missing method details: ${missing.join(", ")}`, "METHOD_DETAIL_MISSING", 400, { missing });

      // Session gate for cash / pos
      if (["cash", "pos"].includes(row.method)) {
        if (!row.session_id) return envelope("An open cash session is required", "session_required", 409);
        const { data: sess } = await db.from("cash_session").select("id, status")
          .eq("id", row.session_id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
        if (!sess || sess.status !== "open") return envelope("Session must be open", "SESSION_MUST_BALANCE", 409);
      }

      const receiptNo = row.receipt_no ?? `RCP-${Date.now().toString(36).toUpperCase()}`;
      const { data: updated, error: e1 } = await db.from("cash_collection").update({
        status: "posted", receipt_no: receiptNo, posted_at: new Date().toISOString(),
      }).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (e1) return envelope(e1.message, "db_error", 400);

      // Session txn line (in)
      if (row.session_id) {
        await db.from("cash_session_txn").insert({
          tenant_id: auth.ctx.tenantId, session_id: row.session_id,
          txn_kind: "collection", cash_collection_id: row.id,
          method: row.method, amount_minor: row.net_collected_minor, direction: "in",
        });
      }

      // Queue ZATCA (idempotent per collection)
      const invoiceType = row.claim_id ? "b2b_insurance" : "b2c_patient";
      await db.from("tax_invoice").insert({
        tenant_id: auth.ctx.tenantId,
        invoice_type: invoiceType,
        counterparty_type: row.claim_id ? "payer" : "patient",
        counterparty_id: row.beneficiary_id,
        claim_id: row.claim_id ?? null,
        cash_collection_id: row.id,
        gross_minor: row.gross_minor, taxable_base_minor: row.gross_minor,
        vat_rate: 15, vat_minor: 0, total_minor: row.gross_minor,
        reporting_box: "output_standard",
        zatca_status: "pending",
      });

      // Log to interface_log (informational; the enqueue trigger already touches erp_posting_queue)
      await logCall({ db, tenantId: auth.ctx.tenantId, interfaceKey: "zatca.einvoice",
        direction: "outbound", trigger: "cash.collection.posted", correlationId: row.id,
        payload: { collection_id: row.id, invoice_type: invoiceType, gross: row.gross_minor },
        status: "queued" });

      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "cash.collection.post", "cash_collection", row.id, { receipt_no: receiptNo });
      return jsonData({ data: updated });
    },
  } },
});