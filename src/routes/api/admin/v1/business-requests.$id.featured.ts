import { createFileRoute } from "@tanstack/react-router";
import { adminAudit, adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

/**
 * Toggle / edit a subscriber's public marquee display.
 * PATCH /api/admin/v1/business-requests/:id/featured
 *   { display_publicly?, display_consent?, display_name?, display_city?,
 *     display_type?, logo_url?, featured_order?, display_consent_source? }
 */
export const Route = createFileRoute("/api/admin/v1/business-requests/$id/featured")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      PATCH: async ({ request, params }) => {
        const auth = await requireAdmin(request, "subscribers:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => ({})) as Record<string, unknown>;
        const patch: Record<string, unknown> = {};
        for (const k of ["display_publicly","display_consent","display_name","display_city","display_type","logo_url","featured_order","display_consent_source"]) {
          if (k in body) patch[k] = (body as Record<string, unknown>)[k];
        }
        if (Object.keys(patch).length === 0)
          return json({ error: "no_fields", code: "validation", request_id: crypto.randomUUID() }, 400);
        const db = adminDb();
        const { data, error } = await db.from("business_requests")
          .update(patch).eq("id", params.id).select().single();
        if (error) return json({ error: error.message, code: "db/update_failed", request_id: crypto.randomUUID() }, 400);
        await adminAudit(auth.userId, "business_request.featured", "business_requests", params.id, patch);
        return json(data);
      },
    },
  },
});