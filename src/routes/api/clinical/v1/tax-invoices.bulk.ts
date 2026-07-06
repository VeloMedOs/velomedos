import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Bulk tax-invoice actions (submit / reprint / cancel). */
const Body = z.object({
  action: z.enum(["submit","reprint","cancel"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/tax-invoices/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "tax.submit" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      const db = serviceClient() as any;
      for (const id of parsed.data.ids) {
        try {
          if (parsed.data.action === "cancel") {
            const { error } = await db.from("tax_invoice").update({ zatca_status: "cancelled" })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            results.push({ id, ok: !error, error: "database_error" });
          } else {
            const path = parsed.data.action === "submit" ? "submit" : "reprint";
            const r = await fetch(new URL(`/api/clinical/v1/tax-invoices/${id}/${path}`, new URL(request.url).origin), {
              method: "POST", headers: {
                "content-type": "application/json",
                cookie: request.headers.get("cookie") ?? "",
                authorization: request.headers.get("authorization") ?? "",
              }, body: "{}",
            });
            results.push({ id, ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` });
          }
        } catch (e) { results.push({ id, ok: false, error: (e as Error).message }); }
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `tax.invoice.bulk.${parsed.data.action}`, "tax_invoice", undefined, { count: results.length, ok: results.filter((r) => r.ok).length });
      return jsonData({ data: results });
    },
  } },
});