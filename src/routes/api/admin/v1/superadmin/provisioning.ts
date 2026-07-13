import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/provisioning")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "provisioning:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        let q = adminDb().from("tenant_provisioning_request").select("*").order("created_at", { ascending: false });
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ requests: data ?? [] });
      },
      POST: async ({ request }) => {
        const auth = await requireAdmin(request, "provisioning:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body || typeof body.admin_email !== "string" || typeof body.requested_slug !== "string") {
          return json({ error: "invalid_input", code: "validation", request_id: crypto.randomUUID() }, 400);
        }
        const { data, error } = await adminDb().from("tenant_provisioning_request").insert({
          admin_email: body.admin_email,
          requested_slug: body.requested_slug,
          target_tenant_type: (body.target_tenant_type as "sandbox" | "partner" | "production" | undefined) ?? "partner",
          business_request_id: (body.business_request_id as string | undefined) ?? null,
          cluster_id: (body.cluster_id as string | undefined) ?? null,
          notes: (body.notes as string | undefined) ?? null,
          requested_by: auth.via === "session" ? auth.userId : null,
          status: "pending",
          handoff_payload: (body.handoff_payload as object | undefined) ?? {},
        }).select().single();
        if (error) return json({ error: "database_error", code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "provisioning.create", "tenant_provisioning_request", (data as { id: string }).id, body);
        return json(data, 201);
      },
    },
  },
});