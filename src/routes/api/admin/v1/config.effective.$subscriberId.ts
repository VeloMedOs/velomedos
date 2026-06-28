import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireAdmin, serviceClient } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/config/effective/$subscriberId")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireAdmin(request, "config:read"); if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient().rpc("portal_effective_config", { _subscriber: params.subscriberId });
        if (error) return json({ error: error.message, code: "db/rpc_failed", request_id: crypto.randomUUID() }, 500);
        return json({ effective: data });
      },
    },
  },
});