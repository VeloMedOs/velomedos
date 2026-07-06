import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Retry a failed/queued interface message (increments retry_count). */
export const Route = createFileRoute("/api/clinical/v1/interfaces/log/$id/retry")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "iface.retry" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: row, error: e0 } = await db.from("interface_log").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (e0 || !row) return envelope("Not found", "not_found", 404);
      const { data, error } = await db.from("interface_log").update({
        status: "retrying",
        retry_count: (row.retry_count ?? 0) + 1,
        last_error: null,
      }).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "interface.retry", "interface_log", params.id, { interface: row.interface_name });
      return jsonData({ data });
    },
  } },
});