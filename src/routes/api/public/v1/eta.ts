import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey } from "@/lib/api-server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

export const Route = createFileRoute("/api/public/v1/eta")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = await requireKey(request, "fleet:read");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => null) as { origin?: { lat: number; lng: number }; destination?: { lat: number; lng: number } } | null;
        if (!body?.origin || !body?.destination) return json({ error: "origin and destination required" }, 400);
        const lovableKey = process.env.LOVABLE_API_KEY;
        const connKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!lovableKey || !connKey) return json({ error: "Maps connector not configured" }, 503);
        const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": connKey,
            "Content-Type": "application/json",
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
          },
          body: JSON.stringify({
            origin: { location: { latLng: body.origin } },
            destination: { location: { latLng: body.destination } },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
          }),
        });
        if (!res.ok) return json({ error: `Routes ${res.status}` }, 502);
        const data = await res.json() as { routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }> };
        const r = data.routes?.[0];
        const seconds = r?.duration ? Number(String(r.duration).replace("s", "")) : 0;
        return json({
          distance_km: r?.distanceMeters ? +(r.distanceMeters / 1000).toFixed(2) : 0,
          duration_seconds: seconds,
          polyline: r?.polyline?.encodedPolyline ?? null,
        });
      },
    },
  },
});