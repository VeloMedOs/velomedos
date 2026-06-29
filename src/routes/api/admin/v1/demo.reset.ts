import { createFileRoute } from "@tanstack/react-router";
import { json, preflight } from "@/lib/api-server";
import { resetDemo } from "@/lib/demo-seed.functions";

/**
 * POST /api/admin/v1/demo/reset
 *
 * Superadmin-only. Deletes transactional rows for the demo tenant (FK-child
 * first, scoped DELETE — never TRUNCATE) and re-runs the seed. Refuses to
 * run unless `corporate_accounts.is_demo = true` for the resolved tenant.
 */
export const Route = createFileRoute("/api/admin/v1/demo/reset")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const body = await request.text();
        let parsed: unknown = {};
        if (body) { try { parsed = JSON.parse(body); } catch { /* ignore */ } }
        const res = await resetDemo({
          data: parsed,
          headers: { authorization: request.headers.get("authorization") ?? "" },
        } as never);
        return json(res, res.ok ? 200 : 403);
      },
    },
  },
});