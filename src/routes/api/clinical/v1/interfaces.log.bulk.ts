import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Bulk interface actions (retry / mark_dead). */
const Body = z.object({
  action: z.enum(["retry","mark_dead"]),
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const Route = createFileRoute("/api/clinical/v1/interfaces/log/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "iface.retry" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const target = parsed.data.action === "retry" ? "retrying" : "dead";
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      for (const id of parsed.data.ids) {
        const { error } = await db.from("interface_log").update({ status: target })
          .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
        results.push({ id, ok: !error, error: error?.message });
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `interface.bulk.${parsed.data.action}`, "interface_log", undefined, { count: results.length });
      return jsonData({ data: results });
    },
  } },
});