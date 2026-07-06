import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";
import { buildZatcaInvoice, simulateSubmit } from "@/lib/rcm/zatca";
import { logCall } from "@/lib/rcm/interface-registry";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Submit a tax invoice to ZATCA (sandbox until creds provided). */
export const Route = createFileRoute("/api/clinical/v1/tax-invoices/$id/submit")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "tax.submit" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: inv, error: e0 } = await db.from("tax_invoice").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (e0 || !inv) return envelope("Invoice not found", "not_found", 404);
      const { data: lines } = await db.from("tax_invoice_line").select("*")
        .eq("tenant_id", auth.ctx.tenantId).eq("invoice_id", inv.id).order("seq");

      // Get previous hash for chain (last submitted per tenant)
      const { data: prev } = await db.from("tax_invoice")
        .select("zatca_hash").eq("tenant_id", auth.ctx.tenantId)
        .in("zatca_status", ["cleared", "reported"])
        .order("issued_at", { ascending: false }).limit(1).maybeSingle();

      const built = await buildZatcaInvoice({
        invoice_uuid: inv.zatca_uuid ?? crypto.randomUUID(),
        invoice_no: inv.invoice_no,
        invoice_type: inv.invoice_type,
        issued_at: inv.issued_at ?? new Date().toISOString(),
        seller: { name: "VeloMed Provider", vat_no: "300000000000003" },
        buyer: { name: "", national_id: inv.counterparty_id ?? "" },
        lines: (lines ?? []).map((l: any) => ({
          description: l.description, service_code: l.service_code,
          qty: Number(l.qty), unit_price_minor: l.unit_price_minor,
          discount_minor: l.discount_minor, vat_rate: Number(l.vat_rate) as 0 | 15,
          reporting_code: l.reporting_code,
        })),
        prev_hash: prev?.zatca_hash ?? null,
      });
      const sim = simulateSubmit(built);
      const { data: updated, error } = await db.from("tax_invoice").update({
        zatca_uuid: built.invoice_uuid,
        zatca_hash: built.hash,
        zatca_prev_hash: built.prev_hash,
        zatca_qr: built.qr_tlv_base64,
        zatca_signed_xml: built.signed_xml,
        zatca_status: sim.status,
        irn: sim.irn,
      }).eq("id", inv.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await logCall({ db, tenantId: auth.ctx.tenantId, interfaceKey: "zatca.einvoice",
        direction: "outbound", trigger: "tax_invoice.submit", correlationId: inv.id,
        payload: built.submitted_payload, response: sim,
        status: sim.ok ? (sim.status === "cleared" ? "ack" : "sent") : "failed",
        error: sim.ok ? null : sim.error ?? "submit_failed" });
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "tax.invoice.submit", "tax_invoice", inv.id, { status: sim.status, irn: sim.irn });
      return jsonData({ data: updated });
    },
  } },
});