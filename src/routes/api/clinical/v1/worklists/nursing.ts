import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/nursing?class=IMP
 * Reads `public.v_nursing_workbench`. Spec 05 §2.
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/nursing")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.nursing.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const cls = url.searchParams.get("class");
      const db = serviceClient() as any;
      let q = db.from("v_nursing_workbench").select("*").eq("tenant_id", auth.ctx.tenantId);
      if (cls) q = q.eq("class", cls);
      const { data, error } = await q.limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});