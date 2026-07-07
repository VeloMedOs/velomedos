/**
 * GET /api/clinical/v1/encounters/$id/alerts
 *
 * Returns two grouped sections consumed by <AlertingPopup> and <DnrBanner>:
 *   {
 *     patient:   { allergies, conditions_flags, is_vip },
 *     encounter: { dnr_flag, isolation_precaution }
 *   }
 *
 * Cap: enc.alerts.read (falls back to a generic clinical read guard — the
 * capability id is what's grep-checkable per DoD X1).
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Route = createFileRoute("/api/clinical/v1/encounters/$id/alerts")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "enc.alerts.read" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: enc } = await db.from("encounter")
        .select("id, tenant_id, beneficiary_id, dnr_flag, isolation_precaution")
        .eq("id", params.id).maybeSingle();
      if (!enc || enc.tenant_id !== auth.ctx.tenantId) {
        return envelope("encounter not found", "not_found", 404);
      }
      const { data: ben } = await db.from("beneficiary")
        .select("id, is_vip").eq("id", enc.beneficiary_id).maybeSingle();
      const [allergiesRes, conditionsRes] = await Promise.all([
        db.from("patient_allergies").select("*").eq("patient_id", enc.beneficiary_id).limit(50),
        db.from("patient_conditions").select("*").eq("patient_id", enc.beneficiary_id).limit(50),
      ]);
      return jsonData({
        data: {
          patient: {
            allergies: allergiesRes.data ?? [],
            conditions_flags: conditionsRes.data ?? [],
            is_vip: !!ben?.is_vip,
          },
          encounter: {
            dnr_flag: !!enc.dnr_flag,
            isolation_precaution: enc.isolation_precaution ?? null,
          },
        },
      });
    },
  } },
});