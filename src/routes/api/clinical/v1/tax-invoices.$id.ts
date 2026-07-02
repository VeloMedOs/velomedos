import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Tax invoice detail — invoice + lines + parent + children. */
export const Route = createFileRoute("/api/clinical/v1/tax-invoices/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: invoice, error } = await db.from("tax_invoice").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (error || !invoice) return envelope("Invoice not found", "not_found", 404);
      const [{ data: lines }, { data: children }, parentQ] = await Promise.all([
        db.from("tax_invoice_line").select("*").eq("tenant_id", auth.ctx.tenantId).eq("invoice_id", params.id).order("seq"),
        db.from("tax_invoice").select("id, invoice_no, invoice_type, total_minor, zatca_status")
          .eq("tenant_id", auth.ctx.tenantId).eq("parent_invoice_id", params.id),
        invoice.parent_invoice_id
          ? db.from("tax_invoice").select("id, invoice_no, invoice_type, total_minor, zatca_status")
              .eq("id", invoice.parent_invoice_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return jsonData({ data: { invoice, lines: lines ?? [], children: children ?? [], parent: parentQ.data } });
    },
  } },
});