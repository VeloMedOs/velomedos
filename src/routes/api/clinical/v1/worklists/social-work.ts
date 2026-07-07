import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/social-work
 * Inpatient / emergency encounters with open specialty forms.
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/social-work")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.social_work.read" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: forms, error: fErr } = await db
        .from("v_clinical_forms_worklist")
        .select("encounter_id")
        .eq("tenant_id", auth.ctx.tenantId)
        .eq("classification", "specialty")
        .in("status", ["pending", "in_progress", "draft"])
        .not("encounter_id", "is", null)
        .limit(400);
      if (fErr) return envelope("database_error", "db_error", 500);
      const ids = Array.from(new Set((forms ?? []).map((f: any) => f.encounter_id).filter(Boolean)));
      if (!ids.length) return jsonData({ data: [] });
      const { data, error } = await db
        .from("v_doctor_worklist")
        .select("*")
        .eq("tenant_id", auth.ctx.tenantId)
        .in("encounter_id", ids)
        .in("class", ["IMP", "EMER"])
        .order("period_start", { ascending: false })
        .limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});