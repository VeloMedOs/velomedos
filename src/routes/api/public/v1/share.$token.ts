import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";

// PUBLIC, NO API KEY — token in path is the credential, validated for expiry/revocation.
export const Route = createFileRoute("/api/public/v1/share/$token")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ params }) => {
        const db = serviceClient();
        const { data: share } = await db
          .from("trip_shares")
          .select("id,trip_id,expires_at,revoked_at")
          .eq("token", params.token)
          .maybeSingle();
        if (!share) return json({ error: "Invalid or expired link" }, 404);
        if (share.revoked_at) return json({ error: "Link revoked" }, 410);
        if (new Date(share.expires_at).getTime() < Date.now()) return json({ error: "Link expired" }, 410);
        const { data: trip } = await db
          .from("trips")
          .select("id,resource_kind,resource_id,incident_id,started_at,ended_at,distance_km,duration_seconds,max_speed_kmh,avg_speed_kmh,polyline,status")
          .eq("id", share.trip_id)
          .maybeSingle();
        if (!trip) return json({ error: "Trip not found" }, 404);
        const { data: loc } = await db
          .from("resource_locations")
          .select("lat,lng,speed_kmh,heading,recorded_at")
          .eq("resource_kind", trip.resource_kind)
          .eq("resource_id", trip.resource_id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        let pickup: { lat: number; lng: number } | null = null;
        let address: string | null = null;
        if (trip.incident_id) {
          const { data: inc } = await db.from("incidents").select("pickup_lat,pickup_lng,address,code").eq("id", trip.incident_id).maybeSingle();
          if (inc?.pickup_lat != null && inc.pickup_lng != null) {
            pickup = { lat: inc.pickup_lat, lng: inc.pickup_lng };
            address = inc.address;
          }
        }
        return json({ trip, current: loc, pickup, address, expires_at: share.expires_at });
      },
    },
  },
});