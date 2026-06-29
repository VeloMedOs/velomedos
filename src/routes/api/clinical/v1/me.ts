import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant } from "@/lib/api-clinical";
import { jsonData } from "./_helpers";

/**
 * GET /api/clinical/v1/me
 *
 * Returns the current caller's tenant membership for UI gating.
 * Server-side enforcement still lives in requireClinicalRole on each route.
 */
export const Route = createFileRoute("/api/clinical/v1/me")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        return jsonData({
          data: {
            user_id: auth.ctx.userId,
            tenant_id: auth.ctx.tenantId,
            role: auth.ctx.role,
            clinical_role: auth.ctx.clinicalRole,
          },
        });
      },
    },
  },
});