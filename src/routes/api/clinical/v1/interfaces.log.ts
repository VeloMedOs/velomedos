import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Interface log worklist — bucketed by status, filtered by interface. */
export const Route = createFileRoute("/api/clinical/v1/interfaces/log")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.interfaces" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const name = url.searchParams.get("interface_name");
      const dir  = url.searchParams.get("direction");
      const st   = url.searchParams.get("status");
      const corr = url.searchParams.get("correlation_id");
      const from = url.searchParams.get("from");
      const to   = url.searchParams.get("to");
      const limit  = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 200)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const db = serviceClient() as any;
      let sel: any = db.from("interface_log").select("*", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (name) sel = sel.eq("interface_name", name);
      if (dir)  sel = sel.eq("direction", dir);
      if (st)   sel = sel.eq("status", st);
      if (corr) sel = sel.eq("correlation_id", corr);
      if (from) sel = sel.gte("created_at", from);
      if (to)   sel = sel.lte("created_at", to);
      const { data, count, error } = await sel;
      if (error) return envelope("database_error", "db_error", 500);
      const { data: agg } = await db.from("interface_log").select("status").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = {};
      for (const r of (agg ?? []) as any[]) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return jsonData({ data, counts, pagination: { total: count ?? 0, limit, offset } });
    },
  } },
});