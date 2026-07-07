import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/front-office
 * Registered/arrived encounters (any class). journey_state ∈ registered/encounter_open.
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/front-office")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.front_office.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const cls = url.searchParams.get("class");
      const db = serviceClient() as any;
      let q = db.from("v_doctor_worklist").select("*").eq("tenant_id", auth.ctx.tenantId)
        .in("journey_state", ["registered", "encounter_open"]);
      if (cls) q = q.eq("class", cls);
      const { data, error } = await q.order("period_start", { ascending: false }).limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});