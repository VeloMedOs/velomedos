import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/ops/security")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "config:read"); if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("ops_security_settings").select("*").eq("id","global").maybeSingle();
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json(data ?? { id: "global" });
      },
      PATCH: async ({ request }) => {
        const auth = await requireAdmin(request, "config:write"); if (!auth.ok) return auth.res;
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return json({ error: "missing_body", code: "validation", request_id: crypto.randomUUID() }, 400);
        const allowed = ["password_min_length","password_require_symbol","password_require_number","mfa_required_roles","session_ttl_minutes","ip_allowlist"];
        const patch: Record<string, unknown> = { updated_by: auth.userId };
        for (const k of allowed) if (k in body) patch[k] = body[k];
        const { data, error } = await adminDb().from("ops_security_settings").update(patch as never).eq("id","global").select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "ops_security_settings.update", "ops_security_settings", "global", patch);
        return json(data);
      },
    },
  },
});