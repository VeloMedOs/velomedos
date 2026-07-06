import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/privileges")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "config:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const role = url.searchParams.get("role");
        let q = adminDb().from("portal_role_privileges").select("*").order("role").order("module");
        if (role) q = q.eq("role", role);
        const { data, error } = await q;
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ privileges: data ?? [] });
      },
      PUT: async ({ request }) => {
        const auth = await requireAdmin(request, "config:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { role?: string; module?: string; can_view?: boolean; can_manage?: boolean } | null;
        if (!body?.role || !body?.module) return json({ error: "missing:role|module", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("portal_role_privileges")
          .upsert({ role: body.role, module: body.module, can_view: !!body.can_view, can_manage: !!body.can_manage, updated_at: new Date().toISOString() }, { onConflict: "role,module" })
          .select().single();
        if (error) return json({ error: "database_error", code: "db/upsert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "privilege.upsert", "portal_role_privileges", `${body.role}:${body.module}`, body);
        return json(data);
      },
      DELETE: async ({ request }) => {
        const auth = await requireAdmin(request, "config:write");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const role = url.searchParams.get("role");
        const module = url.searchParams.get("module");
        if (!role || !module) return json({ error: "missing:role|module", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { error } = await adminDb().from("portal_role_privileges").delete().eq("role", role).eq("module", module);
        if (error) return json({ error: "database_error", code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "privilege.delete", "portal_role_privileges", `${role}:${module}`, null);
        return json({ ok: true });
      },
    },
  },
});