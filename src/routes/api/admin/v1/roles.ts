import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const ROLES = ["superadmin","admin","dispatcher","developer","business_admin","paramedic","driver","patient"] as const;

export const Route = createFileRoute("/api/admin/v1/roles")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "subscribers:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const userId = url.searchParams.get("user_id");
        let q = adminDb().from("user_roles").select("user_id, role, created_at");
        if (userId) q = q.eq("user_id", userId);
        const { data, error } = await q;
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ grants: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { user_id?: string; role?: string } | null;
        if (!body?.user_id || !body?.role) return json({ error: "missing:user_id|role", code: "validation", request_id: crypto.randomUUID() }, 400);
        if (!ROLES.includes(body.role as typeof ROLES[number])) return json({ error: "invalid_role", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("user_roles").insert({ user_id: body.user_id, role: body.role }).select().single();
        if (error && !String("database_error").toLowerCase().includes("duplicate"))
          return json({ error: "database_error", code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "role.grant", "user_roles", body.user_id, { role: body.role });
        return json(data ?? { user_id: body.user_id, role: body.role, duplicate: true }, 201);
      },
      DELETE: async ({ request }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const user_id = url.searchParams.get("user_id");
        const role = url.searchParams.get("role");
        if (!user_id || !role) return json({ error: "missing:user_id|role", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { error } = await adminDb().from("user_roles").delete().eq("user_id", user_id).eq("role", role);
        if (error) return json({ error: "database_error", code: "db/delete_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "role.revoke", "user_roles", user_id, { role });
        return json({ ok: true });
      },
    },
  },
});