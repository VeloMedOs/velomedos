import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/transfer-discharge
 * IP encounters at discharge/transfer stage.
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/transfer-discharge")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.discharge.read" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db
        .from("v_doctor_worklist")
        .select("*")
        .eq("tenant_id", auth.ctx.tenantId)
        .eq("class", "IMP")
        .in("journey_state", ["admitted", "discharged"])
        .order("period_start", { ascending: false })
        .limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});