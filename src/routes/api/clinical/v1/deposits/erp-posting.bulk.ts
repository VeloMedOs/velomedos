import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Retry / mark-dead / mark-posted ERP queue rows. R7 will replace this with an automated worker. */
const Body = z.object({
  action: z.enum(["retry","mark_dead","mark_posted"]),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/erp-posting/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "erp.repost" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const patch: any = parsed.data.action === "retry"      ? { status: "pending", last_error: null }
                      : parsed.data.action === "mark_dead"   ? { status: "dead" }
                      : { status: "posted", posted_at: new Date().toISOString() };
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      for (const id of parsed.data.ids) {
        const { error } = await db.from("erp_posting_queue").update(patch)
          .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
        results.push(error ? { id, ok: false, error: "database_error" } : { id, ok: true });
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `erp.${parsed.data.action}`, "erp_posting_queue", parsed.data.ids[0], { count: parsed.data.ids.length });
      return jsonData({ data: results });
    },
  } },
});