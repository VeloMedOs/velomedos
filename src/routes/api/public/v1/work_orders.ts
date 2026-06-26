import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/work_orders")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "compliance:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        let q = serviceClient()
          .from("work_orders")
          .select("id,vehicle_id,type,status,opened_at,closed_at,odometer_km,downtime_minutes")
          .order("opened_at", { ascending: false })
          .limit(100);
        if (status) q = q.eq("status", status as never);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json(data);
      },
    },
  },
});