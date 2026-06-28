import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/fleet/$id/location")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "fleet:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("ambulance_locations")
          .select("lat,lng,recorded_at,heading,speed")
          .eq("ambulance_id", params.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) { console.error("public_api", error); return json({ error: "internal_error" }, 500); }
        if (!data) return json({ error: "No location on file" }, 404);
        return json(data);
      },
    },
  },
});