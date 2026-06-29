import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/clinical/v1/eligibility — list visit eligibility rows.
 * Filters: ?status, ?encounter_id, ?beneficiary_id, ?financial_type.
 */
export const Route = createFileRoute("/api/clinical/v1/eligibility")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      let q: any = (serviceClient() as any).from("visit_eligibility")
        .select("*", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      for (const k of ["status", "encounter_id", "beneficiary_id", "financial_type"]) {
        const v = url.searchParams.get(k);
        if (v !== null && v !== "") q = q.eq(k, v);
      }
      const { data, count, error } = await q;
      if (error) return envelope(error.message, "db_error", 500);
      return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
    },
  } },
});