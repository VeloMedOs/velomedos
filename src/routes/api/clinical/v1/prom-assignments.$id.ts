import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

export const Route = createFileRoute("/api/clinical/v1/prom-assignments/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data: a, error } = await db.from("prom_assignment")
          .select("*, prom_instrument(*)")
          .eq("id", params.id).maybeSingle();
        if (error) return envelope(error.message, "db_error", 500);
        if (!a || a.tenant_id !== auth.ctx.tenantId) return envelope("Not found", "not_found", 404);
        const { data: r } = await db.from("prom_response").select("*").eq("assignment_id", params.id).maybeSingle();
        return jsonData({ data: { ...a, response: r ?? null } });
      },
    },
  },
});