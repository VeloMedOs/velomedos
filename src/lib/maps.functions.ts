import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

/** Real road-based ETA + distance from origin to destination via Google Routes API. */
export const computeRouteEta = createServerFn({ method: "POST" })
  .inputValidator((input: { origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }) => input)
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !connKey) {
      // Fallback: straight-line estimate at 50 km/h
      const R = 6371;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(data.destination.lat - data.origin.lat);
      const dLng = toRad(data.destination.lng - data.origin.lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(data.origin.lat)) * Math.cos(toRad(data.destination.lat)) * Math.sin(dLng / 2) ** 2;
      const km = 2 * R * Math.asin(Math.sqrt(a));
      return { distance_km: +km.toFixed(2), duration_seconds: Math.round((km / 50) * 3600), polyline: null as string | null, source: "fallback" as const };
    }
    try {
      const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey,
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: { location: { latLng: data.origin } },
          destination: { location: { latLng: data.destination } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      });
      if (!res.ok) throw new Error(`Routes ${res.status}`);
      const body = (await res.json()) as { routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }> };
      const r = body.routes?.[0];
      const seconds = r?.duration ? Number(String(r.duration).replace("s", "")) : 0;
      return {
        distance_km: r?.distanceMeters ? +(r.distanceMeters / 1000).toFixed(2) : 0,
        duration_seconds: seconds,
        polyline: r?.polyline?.encodedPolyline ?? null,
        source: "google" as const,
      };
    } catch (e) {
      return { distance_km: 0, duration_seconds: 0, polyline: null, source: "error" as const, error: (e as Error).message };
    }
  });