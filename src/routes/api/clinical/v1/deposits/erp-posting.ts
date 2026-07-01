import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · ERP posting queue read view — R7 will build the D365 connector that drains it. */
export const Route = createFileRoute("/api/clinical/v1/deposits/erp-posting")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const entity = url.searchParams.get("entity_type");
      const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      let sel: any = (serviceClient() as any).from("erp_posting_queue")
        .select("*", { count: "exact" }).eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (status) sel = sel.eq("status", status);
      if (entity) sel = sel.eq("entity_type", entity);
      const { data, count, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      const { data: all } = await (serviceClient() as any).from("erp_posting_queue").select("status").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = {};
      for (const r of (all ?? []) as any[]) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return jsonData({ data: data ?? [], counts, pagination: { total: count ?? 0, limit, offset } });
    },
  } },
});