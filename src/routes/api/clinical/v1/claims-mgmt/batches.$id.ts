import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/batches/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("claim_batch").select("*").eq("id", params.id).maybeSingle();
      if (error) return envelope("database_error", "db_error", 500);
      if (!data || data.tenant_id !== auth.ctx.tenantId) return envelope("not_found", "not_found", 404);
      const { data: claims } = await db.from("claim")
        .select("id, claim_sequence_no, provider_claim_no, status, readiness_status, snapshot_locked_at, total_net_minor, total_patient_share_minor, total_payer_share_minor, currency")
        .eq("batch_id", params.id).eq("tenant_id", auth.ctx.tenantId);
      return jsonData({ data: { ...data, claims: claims ?? [] } });
    },
    DELETE: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: b } = await db.from("claim_batch").select("id, tenant_id, status").eq("id", params.id).maybeSingle();
      if (!b || b.tenant_id !== auth.ctx.tenantId) return envelope("not_found", "not_found", 404);
      if (b.status !== "open") return envelope(`Only open batches can be cancelled (was ${b.status})`, "invalid_state", 409);
      await db.from("claim").update({ batch_id: null }).eq("batch_id", params.id);
      const { error } = await db.from("claim_batch")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_by: auth.ctx.userId })
        .eq("id", params.id);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ ok: true });
    },
  } },
});