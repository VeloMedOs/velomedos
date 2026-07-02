import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";
import { computeInvoice } from "@/lib/rcm/vat-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R7 · Tax invoices (ZATCA) — list + issue.
 *
 * Split rule: insured encounters emit B2B (payer) + B2C (patient share).
 * Line-level `vat_rate` (0 or 15) drives the totals; invoice type +
 * reporting_box classify submission channel.
 */
const CreateBody = z.object({
  invoice_type: z.enum(["b2b_insurance","b2c_patient","direct_company","credit_note","debit_note"]),
  encounter_id: z.string().uuid().nullable().optional(),
  claim_id:     z.string().uuid().nullable().optional(),
  buyer_id:     z.string().uuid().nullable().optional(),
  lines: z.array(z.object({
    description: z.string(),
    qty: z.number().default(1),
    unit_price_minor: z.number().int().min(0),
    discount_minor: z.number().int().min(0).default(0),
    vat_rate: z.union([z.literal(0), z.literal(15)]).default(15),
    reporting_code: z.string().optional(),
  })).min(1),
  parent_invoice_id: z.string().uuid().nullable().optional(),
  reason: z.string().optional(),
});

function counterpartyOf(t: string): "payer" | "patient" | "direct" {
  if (t === "b2b_insurance") return "payer";
  if (t === "b2c_patient")   return "patient";
  return "direct";
}
function reportingBox(t: string): "output_standard" | "output_zero" | "refund_adjustment" {
  if (t === "credit_note" || t === "debit_note") return "refund_adjustment";
  return "output_standard";
}

export const Route = createFileRoute("/api/clinical/v1/tax-invoices")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status  = url.searchParams.get("status");
      const type    = url.searchParams.get("type");
      const encId   = url.searchParams.get("encounter_id");
      const claimId = url.searchParams.get("claim_id");
      const buyerId = url.searchParams.get("buyer_id");
      const q       = url.searchParams.get("q");
      const limit   = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset  = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const db = serviceClient() as any;
      let sel: any = db.from("tax_invoice").select("*", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status)  sel = sel.eq("zatca_status", status);
      if (type)    sel = sel.eq("invoice_type", type);
      if (encId)   sel = sel.eq("cash_collection_id", encId); // encounter linkage indirect
      if (claimId) sel = sel.eq("claim_id", claimId);
      if (buyerId) sel = sel.eq("counterparty_id", buyerId);
      if (q)       sel = sel.or(`invoice_no.ilike.%${q}%,irn.ilike.%${q}%,zatca_uuid::text.ilike.%${q}%`);
      const { data, count, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      const { data: agg } = await db.from("tax_invoice").select("zatca_status").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = {};
      for (const r of (agg ?? []) as any[]) counts[r.zatca_status] = (counts[r.zatca_status] ?? 0) + 1;
      return jsonData({ data, counts, pagination: { total: count ?? 0, limit, offset } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "tax.issue" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => CreateBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const b = parsed.data;
      const rollup = computeInvoice(b.lines);
      const db = serviceClient() as any;
      const inv = {
        tenant_id: auth.ctx.tenantId,
        invoice_no: `INV-${Date.now().toString(36).toUpperCase()}`,
        invoice_type: b.invoice_type,
        counterparty_type: counterpartyOf(b.invoice_type),
        counterparty_id: b.buyer_id ?? null,
        claim_id: b.claim_id ?? null,
        parent_invoice_id: b.parent_invoice_id ?? null,
        gross_minor: rollup.gross_minor,
        discount_minor: rollup.discount_minor,
        taxable_base_minor: rollup.taxable_base_minor,
        vat_rate: 15,
        vat_minor: rollup.vat_minor,
        total_minor: rollup.total_minor,
        reporting_box: reportingBox(b.invoice_type),
        zatca_status: "pending",
        issued_at: new Date().toISOString(),
        created_by: auth.ctx.userId,
      };
      const { data: invoice, error } = await db.from("tax_invoice").insert(inv).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      const lineRows = rollup.lines.map((l, i) => ({
        tenant_id: auth.ctx.tenantId, invoice_id: invoice.id, seq: i + 1,
        description: l.description ?? null, service_code: l.service_code ?? null,
        qty: l.qty ?? 1, unit_price_minor: l.unit_price_minor, discount_minor: l.discount_minor ?? 0,
        taxable_minor: l.taxable_minor, vat_rate: l.vat_rate ?? 15, vat_minor: l.vat_minor,
        reporting_code: l.reporting_code ?? null,
      }));
      await db.from("tax_invoice_line").insert(lineRows);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "tax.invoice.issue", "tax_invoice", invoice.id, { type: b.invoice_type, total_minor: rollup.total_minor });
      return jsonData({ data: invoice }, 201);
    },
  } },
});