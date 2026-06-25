import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/fleet")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request);
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("ambulances")
          .select("id,code,type,status,home_base,current_lat,current_lng,last_ping_at")
          .order("code");
        if (error) return json({ error: error.message }, 500);
        return json(data);
      },
    },
  },
});