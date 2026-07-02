import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Interface log detail — row + sibling messages sharing the same correlation_id. */
export const Route = createFileRoute("/api/clinical/v1/interfaces/log/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.interfaces" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: row, error } = await db.from("interface_log").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (error || !row) return envelope("Not found", "not_found", 404);
      let siblings: any[] = [];
      if (row.correlation_id) {
        const { data } = await db.from("interface_log").select("id, interface_name, direction, status, created_at")
          .eq("tenant_id", auth.ctx.tenantId).eq("correlation_id", row.correlation_id)
          .neq("id", row.id).order("created_at").limit(200);
        siblings = data ?? [];
      }
      return jsonData({ data: { row, siblings } });
    },
  } },
});