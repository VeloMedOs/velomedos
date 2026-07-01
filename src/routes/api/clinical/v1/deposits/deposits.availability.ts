import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R6 · Available deposit balance for a beneficiary (optionally scoped to encounter).
 * Used by the R3 claim drawer + R4 admissions widget to pre-fill "Apply deposit".
 */
export const Route = createFileRoute("/api/clinical/v1/deposits/deposits/availability")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const beneficiaryId = url.searchParams.get("beneficiary_id");
      if (!beneficiaryId) return envelope("beneficiary_id required", "invalid_request", 400);
      const encounterId = url.searchParams.get("encounter_id");
      const db = serviceClient() as any;
      let sel: any = db.from("deposit").select("id, deposit_no, status, deposit_type, is_caution, available_minor, amount_minor, currency, method, encounter_id")
        .eq("tenant_id", auth.ctx.tenantId).eq("beneficiary_id", beneficiaryId)
        .in("status", ["collected","partially_applied"])
        .gt("available_minor", 0).order("created_at", { ascending: true });
      if (encounterId) sel = sel.or(`encounter_id.eq.${encounterId},encounter_id.is.null`);
      const { data, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      // Exclude caution deposits from freely-available balance projection.
      const freeAvailable = (data ?? [])
        .filter((r: any) => !r.is_caution)
        .reduce((s: number, r: any) => s + (r.available_minor ?? 0), 0);
      return jsonData({ data: { available_minor: freeAvailable, deposits: data ?? [] } });
    },
  } },
});