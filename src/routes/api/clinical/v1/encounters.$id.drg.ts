import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/drg")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const db = serviceClient() as any;
        const { data: current, error: curErr } = await db.from("drg_assignment")
          .select("*").eq("encounter_id", params.id).eq("status", "assigned").maybeSingle();
        if (curErr) return envelope(curErr.message, "db_error", 500);
        const { data: history, error: histErr } = await db.from("drg_assignment")
          .select("*").eq("encounter_id", params.id).order("assigned_at", { ascending: false });
        if (histErr) return envelope(histErr.message, "db_error", 500);
        return jsonData({ data: { current, history: history ?? [] } });
      },
    },
  },
});