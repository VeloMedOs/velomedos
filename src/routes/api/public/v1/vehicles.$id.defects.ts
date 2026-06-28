import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/vehicles/$id/defects")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "compliance:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("defects")
          .select("id,severity,description,blocks_service,resolved_at,created_at")
          .eq("vehicle_id", params.id)
          .order("created_at", { ascending: false });
        if (error) { console.error("public_api", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
    },
  },
});