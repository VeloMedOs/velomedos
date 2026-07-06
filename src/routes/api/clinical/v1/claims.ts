import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/clinical/v1/claims
 *
 * Tenant-scoped list with optional filters: status, encounter_id, beneficiary_id.
 */
export const Route = createFileRoute("/api/clinical/v1/claims")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireClinicalRole(request, [
          "biller",
          "coder",
          "case_manager",
          "cashier",
          "read_only",
        ]);
        if (!auth.ok) return auth.res;

        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const encounterId = url.searchParams.get("encounter_id");
        const beneficiaryId = url.searchParams.get("beneficiary_id");
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

        const db = serviceClient() as any;
        let q = db
          .from("claim")
          .select(
            "id, encounter_id, provider_claim_no, claim_type, claim_subtype, billing_model, status, total_net_minor, total_patient_share_minor, total_payer_share_minor, currency, submitted_at, created_at, updated_at",
          )
          .eq("tenant_id", auth.ctx.tenantId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (status) q = q.eq("status", status);
        if (encounterId) q = q.eq("encounter_id", encounterId);

        if (beneficiaryId) {
          const { data: encs } = await db
            .from("encounter")
            .select("id")
            .eq("tenant_id", auth.ctx.tenantId)
            .eq("beneficiary_id", beneficiaryId);
          const ids = (encs ?? []).map((e: any) => e.id);
          if (!ids.length) return jsonData({ data: [] });
          q = q.in("encounter_id", ids);
        }

        const { data, error } = await q;
        if (error) return envelope("database_error", "db_error", 500);
        return jsonData({ data });
      },
    },
  },
});