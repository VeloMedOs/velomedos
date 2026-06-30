import { createFileRoute } from "@tanstack/react-router";
import { json, preflight } from "@/lib/api-server";
import { getDemoPublicStateRest } from "@/lib/demo-credentials.functions";

/**
 * GET /api/public/v1/demo/credentials
 *
 * Public endpoint backing the /demo-login auto-fill UX. Always returns the
 * account roster (email, role, landing path). Passwords are only included
 * when the operator has flipped `demo_public_reveal` on from Superadmin.
 */
export const Route = createFileRoute("/api/public/v1/demo/credentials")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async () => {
        const res = await getDemoPublicStateRest();
        return json(res, res.ok ? 200 : 500);
      },
    },
  },
});