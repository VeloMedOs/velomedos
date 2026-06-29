import { createFileRoute } from "@tanstack/react-router";
import { json, preflight } from "@/lib/api-server";
import { runProvisionDemoUsersFromHeader, runSeedDemoFromHeader } from "@/lib/demo-seed.functions";

/**
 * POST /api/admin/v1/demo/seed
 *
 * Superadmin-only. Body `{ "step": "users" | "data" | "all" }`.
 *   - users → idempotently provision the 13 demo accounts.
 *   - data  → seed beneficiaries (requires users first).
 *   - all   → users then data.
 */
export const Route = createFileRoute("/api/admin/v1/demo/seed")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const body = await request.text();
        let step: "users" | "data" | "all" = "all";
        if (body) { try { const p = JSON.parse(body); if (p?.step) step = p.step; } catch { /* ignore */ } }
        if (step === "users") {
          const r = await runProvisionDemoUsersFromHeader(auth);
          return json(r, r.ok ? 200 : 403);
        }
        if (step === "data") {
          const r = await runSeedDemoFromHeader(auth);
          return json(r, r.ok ? 200 : 403);
        }
        const users = await runProvisionDemoUsersFromHeader(auth);
        if (!users.ok) return json(users, 403);
        const data = await runSeedDemoFromHeader(auth);
        return json({ users, data }, data.ok ? 200 : 500);
      },
    },
  },
});