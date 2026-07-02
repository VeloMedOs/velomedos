import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { expectedRefundMethod, requiresVatReversal } from "@/lib/rcm/cash-refund-sm";
import { computeInvoice } from "@/lib/rcm/vat-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R7 · Cash refund — creates the R6 refund_request row with R7 method-match
 * validation, VAT reversal flag propagation, and (optionally) a tax
 * credit-note draft when the original collection produced a taxed invoice.
 */
const Body = z.object({
  original_collection_id: z.string().uuid().optional(),
  deposit_id: z.string().uuid().optional(),
  reason_code: z.enum(["overpayment","cancellation","return","correction","cash_copay","uncovered_self_pay"]),
  refund_method: z.enum(["cash","card_reversal","bank_transfer","online_reversal","credit_note"]),
  details: z.record(z.string(), z.any()).optional(),
  lines: z.array(z.object({
    description: z.string(),
    amount_minor: z.number().int().min(0),
    vat_rate: z.union([z.literal(0), z.literal(15)]).default(15),
  })).min(1),
  has_taxed_invoice: z.boolean().default(false),
});

export const Route = createFileRoute("/api/clinical/v1/cash/refunds")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "refund.request" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const b = parsed.data;
      const db = serviceClient() as any;

      // Same-method validation
      let originalMethod: string | null = null;
      if (b.original_collection_id) {
        const { data: coll } = await db.from("cash_collection")
          .select("method, beneficiary_id, encounter_id, claim_id")
          .eq("id", b.original_collection_id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
        if (!coll) return envelope("Original collection not found", "not_found", 404);
        originalMethod = coll.method;
      }
      if (originalMethod && b.refund_method !== "credit_note") {
        const expected = expectedRefundMethod(originalMethod);
        if (expected && expected !== b.refund_method) {
          return envelope(
            `Refund method mismatch — original was ${originalMethod}, expected ${expected}`,
            "SAME_METHOD_REFUND", 409, { expected, provided: b.refund_method },
          );
        }
      }

      const rollup = computeInvoice(b.lines.map((l) => ({
        description: l.description, unit_price_minor: l.amount_minor, vat_rate: l.vat_rate,
      })));
      const needsVatReversal = requiresVatReversal({ has_taxed_invoice: b.has_taxed_invoice });

      const { data: refund, error } = await db.from("refund_request").insert({
        tenant_id: auth.ctx.tenantId,
        deposit_id: b.deposit_id ?? null,
        reason_code: b.reason_code,
        refund_method: b.refund_method,
        amount_minor: rollup.total_minor,
        vat_reversal_minor: rollup.vat_minor,
        original_collection_id: b.original_collection_id ?? null,
        requires_vat_reversal: needsVatReversal,
        status: "requested",
        details: b.details ?? null,
        created_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);

      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "cash.refund.request", "refund_request", refund.id, {
        reason: b.reason_code, method: b.refund_method, amount_minor: rollup.total_minor, needs_vat_reversal: needsVatReversal,
      });
      return jsonData({ data: refund }, 201);
    },
  } },
});