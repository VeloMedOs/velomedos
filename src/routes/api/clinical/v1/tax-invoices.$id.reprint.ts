import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Reprint invoice PDF (stub URL + QR TLV for POS reprint). */
export const Route = createFileRoute("/api/clinical/v1/tax-invoices/$id/reprint")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "tax.issue" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: inv, error } = await db.from("tax_invoice").select("id, invoice_no, zatca_qr")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (error || !inv) return envelope("Invoice not found", "not_found", 404);
      return jsonData({ data: { pdf_url: `/api/clinical/v1/tax-invoices/${inv.id}.pdf`, qr_tlv_base64: inv.zatca_qr ?? "" } });
    },
  } },
});