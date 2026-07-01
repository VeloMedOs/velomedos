import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/remittances/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data } = await db.from("remittance").select("*").eq("id", params.id).maybeSingle();
      if (!data || data.tenant_id !== auth.ctx.tenantId) return envelope("not_found", "not_found", 404);
      const { data: lines } = await db.from("remittance_line")
        .select("*").eq("remittance_id", params.id).order("created_at", { ascending: true });
      const totals = (lines ?? []).reduce((acc: any, l: any) => {
        acc.expected += l.expected_amount_minor ?? 0;
        acc.paid     += l.paid_amount_minor ?? 0;
        acc.diff     += (l.paid_amount_minor ?? 0) - (l.expected_amount_minor ?? 0);
        return acc;
      }, { expected: 0, paid: 0, diff: 0 });
      return jsonData({ data: { ...data, lines: lines ?? [], totals } });
    },
  } },
});