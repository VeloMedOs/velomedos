import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/incidents/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "incidents:read");
        if (!auth.ok) return auth.res;
        let q = serviceClient()
          .from("incidents")
          .select("id,code,severity,status,address,pickup_lat,pickup_lng,symptoms,assigned_ambulance_id,requested_by,sla_target_at,created_at,updated_at")
          .eq("id", params.id);
        if (auth.via === "key") q = q.eq("requested_by", auth.ownerId);
        const { data, error } = await q.maybeSingle();
        if (error) { console.error("incidents.get", error); return json({ error: "internal_error" }, 500); }
        if (!data) return json({ error: "Not found" }, 404);
        return json(data);
      },
    },
  },
});