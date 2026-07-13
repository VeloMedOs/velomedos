import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/provisioning/$id/reject")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireAdmin(request, "provisioning:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { reason?: string } | null;
        const db = adminDb();
        const { data: row } = await db.from("tenant_provisioning_request").select("status").eq("id", params.id).maybeSingle();
        if (!row) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        if (row.status !== "pending") return json({ error: "invalid_status", code: "state/invalid_transition", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await db.from("tenant_provisioning_request").update({
          status: "rejected",
          completed_at: new Date().toISOString(),
          notes: body?.reason ?? null,
        }).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "provisioning.reject", "tenant_provisioning_request", params.id, body ?? null);
        return json(data);
      },
    },
  },
});