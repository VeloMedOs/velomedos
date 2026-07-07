import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/coder
 * status='finished' AND journey_state='discharged'. v_doctor_worklist filters
 * finished encounters out, so this route reads encounter+beneficiary directly
 * and returns rows shaped like DoctorWorklistRow.
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/coder")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.coder.read" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db
        .from("encounter")
        .select(`
          tenant_id, id, class, encounter_number, status, journey_state, period_start,
          dnr_flag, isolation_precaution,
          beneficiary:beneficiary!beneficiary_id (id, patient_file_no, full_name, first_name, middle_name, last_name, dob, gender, is_vip),
          hospitalization:encounter_hospitalization!encounter_id (discharge_disposition)
        `)
        .eq("tenant_id", auth.ctx.tenantId)
        .eq("status", "finished")
        .eq("journey_state", "discharged")
        .order("period_start", { ascending: false })
        .limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      const rows = (data ?? []).map((r: any) => {
        const b = r.beneficiary ?? {};
        const h = Array.isArray(r.hospitalization) ? r.hospitalization[0] : r.hospitalization;
        return {
          tenant_id: r.tenant_id,
          encounter_id: r.id,
          class: r.class,
          encounter_number: r.encounter_number,
          status: r.status,
          journey_state: r.journey_state,
          period_start: r.period_start,
          waiting_seconds: Math.max(0, Math.floor((Date.now() - new Date(r.period_start).getTime()) / 1000)),
          beneficiary_id: b.id ?? null,
          mrn: b.patient_file_no ?? null,
          name: b.full_name ?? ([b.first_name, b.middle_name, b.last_name].filter(Boolean).join(" ") || null),
          age: b.dob ? Math.floor((Date.now() - new Date(b.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null,
          gender: b.gender ?? null,
          token: null,
          is_vip: Boolean(b.is_vip),
          dnr_flag: r.dnr_flag,
          isolation_precaution: r.isolation_precaution,
          discharge_disposition: h?.discharge_disposition ?? null,
          ems_status: null,
          billed_orders: 0, released_orders: 0, locked_orders: 0,
          pending_authorizations: 0, unread_rcm_comms: 0,
          attending_physician: null,
        };
      });
      return jsonData({ data: rows });
    },
  } },
});