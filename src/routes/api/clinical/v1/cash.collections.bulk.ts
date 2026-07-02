import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Bulk cash collection actions (post/void/print/re-queue ZATCA). */
const Body = z.object({
  action: z.enum(["post","void","print_receipt","reissue_zatca"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/cash/collections/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.collect" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      const base = new URL(request.url);
      const cookie = request.headers.get("cookie") ?? "";
      const authz = request.headers.get("authorization") ?? "";
      for (const id of parsed.data.ids) {
        try {
          if (parsed.data.action === "reissue_zatca") {
            // Mark all pending invoices back to queued
            const db = serviceClient() as any;
            await db.from("tax_invoice").update({ zatca_status: "pending" })
              .eq("tenant_id", auth.ctx.tenantId).eq("cash_collection_id", id);
            results.push({ id, ok: true });
            continue;
          }
          const path = parsed.data.action === "post" ? "post" : parsed.data.action === "void" ? "void" : "print";
          const body = parsed.data.action === "void" ? JSON.stringify({ reason: parsed.data.reason ?? "bulk_void" }) : "{}";
          const r = await fetch(new URL(`/api/clinical/v1/cash/collections/${id}/${path}`, base.origin), {
            method: "POST", headers: { "content-type": "application/json", cookie, authorization: authz }, body,
          });
          results.push({ id, ok: r.ok, error: r.ok ? undefined : `HTTP ${r.status}` });
        } catch (e) { results.push({ id, ok: false, error: (e as Error).message }); }
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `cash.collection.bulk.${parsed.data.action}`, "cash_collection", undefined, { count: results.length, ok: results.filter((r) => r.ok).length });
      return jsonData({ data: results });
    },
  } },
});