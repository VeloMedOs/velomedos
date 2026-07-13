import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/tenants/$id/reactivate")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireAdmin(request, "tenants:write");
        if (!auth.ok) return auth.res;
        const db = adminDb();
        const { data: row } = await db.from("corporate_accounts").select("tenant_lifecycle").eq("id", params.id).maybeSingle();
        if (!row) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        if (row.tenant_lifecycle !== "suspended") return json({ error: "invalid_transition", code: "state/invalid_transition", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await db.from("corporate_accounts").update({ tenant_lifecycle: "active" }).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "tenant.reactivate", "corporate_accounts", params.id, null);
        return json(data);
      },
    },
  },
});