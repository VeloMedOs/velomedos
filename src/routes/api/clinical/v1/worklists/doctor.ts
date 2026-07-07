import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/doctor?class=EMER
 *
 * Reads `public.v_doctor_worklist` scoped to the caller's tenant.
 * Spec 05 §2 — HCA-0174/0175/0186/0123.
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/doctor")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.doctor.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const cls = url.searchParams.get("class");
      const db = serviceClient() as any;
      let q = db.from("v_doctor_worklist").select("*").eq("tenant_id", auth.ctx.tenantId);
      if (cls) q = q.eq("class", cls);
      const { data, error } = await q.order("waiting_seconds", { ascending: false }).limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});