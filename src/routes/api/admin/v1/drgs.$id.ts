import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";
import { DrgUpdate } from "@/lib/mds/schema/masters";

export const Route = createFileRoute("/api/admin/v1/drgs/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireAdmin(request, "clinical:reference:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("drg").select("*").eq("id", params.id).maybeSingle();
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        if (!data) return json({ error: "not_found", code: "not_found", request_id: crypto.randomUUID() }, 404);
        return json(data);
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireAdmin(request, "clinical:reference:write");
        if (!auth.ok) return auth.res;
        const raw = await request.json().catch(() => null);
        const parsed = DrgUpdate.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "validation_failed", code: "validation", request_id: crypto.randomUUID() }, 400);
        }
        const { data, error } = await adminDb().from("drg").update(parsed.data).eq("id", params.id).select("*").single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "drg.update", "drg", params.id, parsed.data);
        return json(data);
      },
      DELETE: async ({ request, params }) => {
        const auth = await requireAdmin(request, "clinical:reference:write");
        if (!auth.ok) return auth.res;
        const { error } = await adminDb().from("drg").delete().eq("id", params.id);
        if (error) return json({ error: "database_error", code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "drg.delete", "drg", params.id, null);
        return new Response(null, { status: 204 });
      },
    },
  },
});