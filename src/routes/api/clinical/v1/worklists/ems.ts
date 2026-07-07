import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/ems
 * Ambulance/EMS handoff worklist — EMER-class encounters (spec 05 §2).
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/ems")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.ems.read" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db
        .from("v_doctor_worklist")
        .select("*")
        .eq("tenant_id", auth.ctx.tenantId)
        .eq("class", "EMER")
        .order("waiting_seconds", { ascending: false })
        .limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});