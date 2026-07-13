import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/provisioning/$id/approve")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireAdmin(request, "provisioning:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { completed_tenant_id?: string } | null;
        const db = adminDb();
        const { data: req } = await db.from("tenant_provisioning_request").select("*").eq("id", params.id).maybeSingle();
        if (!req) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        if (req.status !== "pending") return json({ error: "invalid_status", code: "state/invalid_transition", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await db.from("tenant_provisioning_request").update({
          status: "approved",
          completed_at: new Date().toISOString(),
          completed_tenant_id: body?.completed_tenant_id ?? null,
        }).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        if (body?.completed_tenant_id) {
          await db.from("corporate_accounts").update({ tenant_lifecycle: "active" }).eq("id", body.completed_tenant_id);
        }
        await adminAudit(auth.userId, "provisioning.approve", "tenant_provisioning_request", params.id, body ?? null);
        return json(data);
      },
    },
  },
});