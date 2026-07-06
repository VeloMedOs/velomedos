import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/bugs")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "bugs:read"); if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("portal_bugs").select("*").order("last_seen_at", { ascending: false }).limit(300);
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ bugs: data });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "bugs:write"); if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body?.title) return json({ error: "missing_title", code: "validation", request_id: crypto.randomUUID() }, 400);
        const row = { ...body, source: (body.source as string) ?? "internal" } as unknown as never;
        const { data, error } = await adminDb().from("portal_bugs").insert(row).select().single();
        if (error) return json({ error: "database_error", code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "bug.create", "portal_bugs", data.id, body);
        return json(data, 201);
      },
      PATCH: async ({ request }) => {
        const auth = await requireAdmin(request, "bugs:write"); if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { id?: string; status?: string; assignee_id?: string | null } | null;
        if (!body?.id) return json({ error: "missing_id", code: "validation", request_id: crypto.randomUUID() }, 400);
        const upd: Record<string, unknown> = {};
        if (body.status) upd.status = body.status;
        if (body.assignee_id !== undefined) upd.assignee_id = body.assignee_id;
        const { data, error } = await adminDb().from("portal_bugs").update(upd).eq("id", body.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "bug.triage", "portal_bugs", body.id, upd);
        return json(data);
      },
    },
  },
});