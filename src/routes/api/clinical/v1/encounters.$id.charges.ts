import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/charges")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      let q = db.from("charge_item").select("*")
        .eq("tenant_id", auth.ctx.tenantId).eq("encounter_id", params.id)
        .order("ordered_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return envelope("database_error", "db_error", 500);
      const rows = data ?? [];
      const totals = rows.reduce((acc: Record<string, number>, r: any) => {
        if (r.status === "cancelled") return acc;
        acc.gross_minor += (r.unit_price_minor ?? 0) * Number(r.quantity ?? 1) * Number(r.factor ?? 1);
        acc.discount_minor += r.discount_minor ?? 0;
        acc.tax_minor += r.tax_minor ?? 0;
        acc.patient_minor += r.patient_share_minor ?? 0;
        acc.payer_minor += r.payer_share_minor ?? 0;
        acc.net_minor += r.net_minor ?? 0;
        return acc;
      }, { gross_minor: 0, discount_minor: 0, tax_minor: 0, patient_minor: 0, payer_minor: 0, net_minor: 0 });
      return jsonData({ data: { charges: rows, totals, currency: rows[0]?.currency ?? "SAR" } });
    },
  } },
});