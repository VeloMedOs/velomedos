import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

export const Route = createFileRoute("/api/clinical/v1/prom-assignments/$id/remind")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["case_manager", "nurse", "registrar"]);
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data: cur } = await db.from("prom_assignment").select("id, tenant_id, status, reminder_count")
          .eq("id", params.id).maybeSingle();
        if (!cur || cur.tenant_id !== auth.ctx.tenantId) return envelope("Not found", "not_found", 404);
        if (cur.status !== "pending") return envelope("Assignment not pending", "bad_state", 409);
        const { data, error } = await db.from("prom_assignment")
          .update({ reminder_count: (cur.reminder_count ?? 0) + 1, last_reminder_at: new Date().toISOString() } as never)
          .eq("id", params.id).select("*").single();
        if (error) return envelope("database_error", "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "prom_assignment.remind", "prom_assignment", params.id);
        return jsonData({ data });
      },
    },
  },
});