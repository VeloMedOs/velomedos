import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/fleet")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "fleet:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("ambulances")
          .select("id,code,type,status,home_base,current_lat,current_lng,last_ping_at")
          .order("code");
        if (error) { console.error("public_api", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
    },
  },
});