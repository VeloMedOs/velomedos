import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/worklists/mrd
 * Cosign backlog: is_overdue=true OR (status='submitted' AND cosign_required=true AND cosigned_at IS NULL).
 */
export const Route = createFileRoute("/api/clinical/v1/worklists/mrd")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.mrd.read" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db
        .from("v_clinical_forms_worklist")
        .select("*")
        .eq("tenant_id", auth.ctx.tenantId)
        .or("is_overdue.eq.true,and(status.eq.submitted,cosign_required.eq.true,cosigned_at.is.null)")
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
  } },
});