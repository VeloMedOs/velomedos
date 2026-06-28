import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/tickets/$id/events")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireAdmin(request, "tickets:write"); if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { body?: string } | null;
        if (!body?.body) return json({ error: "missing_body", code: "validation", request_id: crypto.randomUUID() }, 400);
        const { data, error } = await adminDb().from("portal_ticket_events").insert({ ticket_id: params.id, body: body.body, actor_id: auth.userId }).select().single();
        if (error) return json({ error: error.message, code: "db/insert_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "ticket.comment", "portal_tickets", params.id, null);
        return json(data, 201);
      },
    },
  },
});