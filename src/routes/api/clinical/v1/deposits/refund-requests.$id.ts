import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Route = createFileRoute("/api/clinical/v1/deposits/refund-requests/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: row, error } = await db.from("refund_request")
        .select("*, deposit:deposit_id(id, deposit_no, deposit_type, is_caution, beneficiary_id, encounter_id, method, amount_minor, available_minor)")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (error || !row) return envelope("Refund request not found", "not_found", 404);
      const { data: attachments } = await db.from("refund_request_attachment").select("*")
        .eq("refund_request_id", row.id).order("created_at", { ascending: true });
      return jsonData({ data: { row, attachments: attachments ?? [] } });
    },
  } },
});