import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, json, preflight, requireAdmin, serviceClient } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/payments/$id/validate")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireAdmin(request, "billing:write");
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data, error } = await db.from("portal_payments").update({
          status: "succeeded", validated_by: auth.userId, validated_at: new Date().toISOString(),
        }).eq("id", params.id).select().single();
        if (error || !data) return json({ error: error?.message ?? "not_found", code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        if (data.subscription_id) {
          await db.from("portal_subscriptions").update({ status: "active", renews_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString() }).eq("id", data.subscription_id);
        }
        await adminAudit(auth.userId, "payment.validate", "portal_payments", params.id, null);
        return json(data);
      },
    },
  },
});