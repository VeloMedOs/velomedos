import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/vehicles/$id/work_orders")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "compliance:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("work_orders")
          .select("id,type,status,opened_at,closed_at,odometer_km,downtime_minutes")
          .eq("vehicle_id", params.id)
          .order("opened_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json(data);
      },
    },
  },
});