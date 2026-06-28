import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/homecare/visits/$id/evv")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "homecare:read");
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data: v } = await db
          .from("care_visits")
          .select("id, tenant_id, care_plan_id, recipient_id, caregiver_id, scheduled_start, scheduled_end, status, check_in_at, check_in_lat, check_in_lng, check_in_distance_m, check_out_at, check_out_lat, check_out_lng, evv_verified, evv_exception")
          .eq("id", params.id)
          .maybeSingle();
        if (!v) return json({ error: "not_found" }, 404);
        const { data: r } = await db
          .from("care_recipients")
          .select("full_name, address, lat, lng, geofence_radius_m")
          .eq("id", v.recipient_id)
          .maybeSingle();
        return json({
          visit: v,
          recipient: r,
          policy: { tolerance_minutes: 30, geofence_radius_m: r?.geofence_radius_m ?? 150 },
          audit: {
            verified: v.evv_verified,
            exception: v.evv_exception,
            distance_m: v.check_in_distance_m,
            within_time_window: v.check_in_at != null && v.check_in_at >= new Date(new Date(v.scheduled_start).getTime() - 30 * 60_000).toISOString() && v.check_in_at <= new Date(new Date(v.scheduled_end).getTime() + 30 * 60_000).toISOString(),
          },
        });
      },
    },
  },
});