import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const NEXT: Record<string, "partner" | "production" | null> = {
  sandbox: "partner",
  partner: "production",
  production: null,
};

export const Route = createFileRoute("/api/admin/v1/superadmin/tenants/$id/promote")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireAdmin(request, "tenants:write");
        if (!auth.ok) return auth.res;
        const db = adminDb();
        const { data: row } = await db.from("corporate_accounts").select("tenant_type").eq("id", params.id).maybeSingle();
        if (!row) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        const next = NEXT[row.tenant_type as string];
        if (!next) return json({ error: "invalid_transition", code: "state/invalid_transition", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await db.from("corporate_accounts").update({ tenant_type: next }).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "tenant.promote", "corporate_accounts", params.id, { from: row.tenant_type, to: next });
        return json(data);
      },
    },
  },
});