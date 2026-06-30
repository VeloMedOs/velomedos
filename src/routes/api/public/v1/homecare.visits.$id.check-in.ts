import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, resolveTenantScope, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/homecare/visits/$id/check-in")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireKey(request, "homecare:write");
        if (!auth.ok) return auth.res;
        const scope = await resolveTenantScope(auth.auth, request);
        if (!scope.ok) return scope.res;
        const body = await request.json().catch(() => ({} as Record<string, unknown>));
        const lat = Number((body as any).lat);
        const lng = Number((body as any).lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return json({ error: "lat and lng required" }, 400);
        }
        const db = serviceClient();
        // Ownership pre-flight: ensure the target visit belongs to caller's tenant.
        const { data: existing } = await db.from("care_visits").select("id, tenant_id").eq("id", params.id).maybeSingle();
        if (!existing) return json({ error: "not_found" }, 404);
        if (existing.tenant_id !== scope.tenantId) return json({ error: "tenant_forbidden" }, 403);
        const { data, error } = await db
          .from("care_visits")
          .update({
            status: "checked_in",
            check_in_at: new Date().toISOString(),
            check_in_lat: lat,
            check_in_lng: lng,
          })
          .eq("id", params.id)
          .eq("tenant_id", scope.tenantId)
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