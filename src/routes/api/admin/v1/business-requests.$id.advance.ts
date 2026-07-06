import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

const STAGES = ["request","contacted","demo","prospect","lead","negotiation","subscribed","rejected","archived"] as const;

export const Route = createFileRoute("/api/admin/v1/business-requests/$id/advance")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { stage?: string; note?: string } | null;
        if (!body?.stage || !STAGES.includes(body.stage as typeof STAGES[number]))
          return json({ error: "invalid_stage", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const { data, error } = await db.from("business_requests")
          .update({ stage: body.stage, status: body.stage === "subscribed" ? "approved" : body.stage === "rejected" ? "rejected" : "new" })
          .eq("id", params.id).select().single();
        if (error) return json({ error: "database_error", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        if (body.note) {
          await db.from("business_request_events").insert({
            request_id: params.id, actor_id: auth.via === "session" ? auth.userId : null,
            kind: "note", to_stage: body.stage, note: body.note,
          });
        }
        await adminAudit(auth.userId, "business_request.advance", "business_requests", params.id, { stage: body.stage });
        return json(data);
      },
    },
  },
});