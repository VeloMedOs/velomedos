import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/homecare/visits/$id/check-in")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireKey(request, "homecare:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => ({} as Record<string, unknown>));
        const lat = Number((body as any).lat);
        const lng = Number((body as any).lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return json({ error: "lat and lng required" }, 400);
        }
        const db = serviceClient();
        const { data, error } = await db
          .from("care_visits")
          .update({
            status: "checked_in",
            check_in_at: new Date().toISOString(),
            check_in_lat: lat,
            check_in_lng: lng,
          })
          .eq("id", params.id)
          .select("id, status, check_in_at, check_in_distance_m, evv_verified, evv_exception")
          .single();
        if (error || !data) { console.error("homecare.check-in", error); return json({ error: error?.message ?? "failed" }, 400); }
        return json({
          ok: true,
          visit_id: data.id,
          status: data.status,
          check_in_at: data.check_in_at,
          distance_m: data.check_in_distance_m,
          evv_verified: data.evv_verified,
          evv_exception: data.evv_exception,
        });
      },
    },
  },
});