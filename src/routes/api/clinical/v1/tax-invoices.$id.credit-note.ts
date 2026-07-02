import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { computeInvoice } from "@/lib/rcm/vat-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R7 · Issue a credit note against a parent invoice (VAT reversal).
 *
 * If `lines` are omitted, the full parent invoice is reversed. Otherwise
 * the caller passes signed positive amounts and the server negates them
 * onto the credit-note lines.
 */
const Body = z.object({
  reason: z.string().min(3),
  lines:  z.array(z.object({
    description: z.string(),
    amount_minor: z.number().int().min(0),
    vat_rate: z.union([z.literal(0), z.literal(15)]).default(15),
  })).optional(),
});

export const Route = createFileRoute("/api/clinical/v1/tax-invoices/$id/credit-note")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "tax.credit_note" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: parent, error: e0 } = await db.from("tax_invoice").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (e0 || !parent) return envelope("Parent invoice not found", "not_found", 404);

      let lines = parsed.data.lines?.map((l) => ({
        description: l.description, qty: 1,
        unit_price_minor: -l.amount_minor, discount_minor: 0, vat_rate: l.vat_rate,
      }));
      if (!lines) {
        const { data: parentLines } = await db.from("tax_invoice_line").select("*")
          .eq("tenant_id", auth.ctx.tenantId).eq("invoice_id", parent.id);
        lines = (parentLines ?? []).map((pl: any) => ({
          description: pl.description, qty: 1,
          unit_price_minor: -pl.taxable_minor, discount_minor: 0, vat_rate: Number(pl.vat_rate) as 0 | 15,
        }));
      }
      const rollup = computeInvoice(lines ?? []);
      const { data: cn, error } = await db.from("tax_invoice").insert({
        tenant_id: auth.ctx.tenantId,
        invoice_no: `CN-${Date.now().toString(36).toUpperCase()}`,
        invoice_type: "credit_note",
        counterparty_type: parent.counterparty_type,
        counterparty_id: parent.counterparty_id,
        claim_id: parent.claim_id,
        cash_collection_id: parent.cash_collection_id,
        parent_invoice_id: parent.id,
        gross_minor: rollup.gross_minor, discount_minor: rollup.discount_minor,
        taxable_base_minor: rollup.taxable_base_minor, vat_rate: 15,
        vat_minor: rollup.vat_minor, total_minor: rollup.total_minor,
        reporting_box: "refund_adjustment",
        zatca_status: "pending",
        issued_at: new Date().toISOString(),
        created_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      const lineRows = rollup.lines.map((l, i) => ({
        tenant_id: auth.ctx.tenantId, invoice_id: cn.id, seq: i + 1,
        description: l.description, qty: l.qty, unit_price_minor: l.unit_price_minor,
        discount_minor: l.discount_minor, taxable_minor: l.taxable_minor,
        vat_rate: l.vat_rate, vat_minor: l.vat_minor,
      }));
      await db.from("tax_invoice_line").insert(lineRows);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "tax.credit_note.issue", "tax_invoice", cn.id, { parent_id: parent.id, reason: parsed.data.reason });
      return jsonData({ data: cn }, 201);
    },
  } },
});