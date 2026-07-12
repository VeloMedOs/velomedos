/**
 * Step 5 · Turn 2 UI · series-eligible services.
 * Returns tenant-scoped `service_master` rows with sub_category='series_therapy'.
 * Backs the SeriesBookingPane service picker — server-side truth so the client
 * never has to guess/filter the seed catalog.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/api/clinical/v1/opd/referral/series/eligible")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireClinicalModule(request, "Clinical", { capId: "referral.series.create" });
        if (!auth.ok) return auth.res;
        const db: any = serviceClient();
        const { data } = await db.from("service_master")
          .select("id, name, specialty, sub_category")
          .eq("tenant_id", auth.ctx.tenantId)
          .eq("sub_category", "series_therapy")
          .eq("active", true)
          .limit(200);
        return jsonData({ ok: true, data: (data ?? []) as any[] });
      },
    },
  },
});