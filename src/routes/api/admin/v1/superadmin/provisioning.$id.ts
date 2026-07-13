import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const ALLOWED = new Set(["notes", "requested_project_ref", "handoff_payload", "target_tenant_type"]);

export const Route = createFileRoute("/api/admin/v1/superadmin/provisioning/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireAdmin(request, "provisioning:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("tenant_provisioning_request").select("*").eq("id", params.id).maybeSingle();
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        if (!data) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        return json(data);
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireAdmin(request, "provisioning:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return json({ error: "invalid_json", code: "validation", request_id: crypto.randomUUID() }, 400);
        const update: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body)) if (ALLOWED.has(k)) update[k] = v;
        if (Object.keys(update).length === 0) return json({ error: "no_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("tenant_provisioning_request").update(update).eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "provisioning.update", "tenant_provisioning_request", params.id, update);
        return json(data);
      },
    },
  },
});