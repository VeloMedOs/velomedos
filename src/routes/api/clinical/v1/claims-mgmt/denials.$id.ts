import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/denials/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data } = await db.from("denial_case").select("*").eq("id", params.id).maybeSingle();
      if (!data || data.tenant_id !== auth.ctx.tenantId) return envelope("not_found", "not_found", 404);
      const [{ data: comms }, { data: claim }] = await Promise.all([
        db.from("denial_communication").select("*").eq("denial_case_id", params.id).order("created_at", { ascending: true }),
        data.claim_id
          ? db.from("claim").select("id, claim_sequence_no, provider_claim_no, status, total_net_minor, total_payer_share_minor, encounter_id, coverage_id").eq("id", data.claim_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return jsonData({ data: { ...data, communications: comms ?? [], claim } });
    },
  } },
});