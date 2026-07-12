/**
 * Step 4 · Turn 3 — Enable Vaccine Clinic (HCA-0231).
 * Idempotent: calls seed_vaccine_clinic() which returns an existing
 * vaccination-specialty clinic id, or creates one + default schedule.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handlePOST(args: { ctx: OpdCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { data, error } = await db.rpc("seed_vaccine_clinic", { _tenant: args.ctx.tenantId });
  if (error) return envelope(error.message ?? "database_error", "db_error", 400);
  return jsonData({ ok: true, data: { clinic_id: data }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/vaccine-clinic/enable")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.vaccine_clinic.admin" });
        if (!auth.ok) return auth.res;
        return handlePOST({ ctx: auth.ctx });
      },
    },
  },
});