import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";

/** Public, cacheable pricing endpoint that drives the marketing /pricing page.
 *  Returns the same plan + add-on catalog the Superadmin "Subscriptions" module manages. */
export const Route = createFileRoute("/api/public/v1/pricing")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async () => {
        const db = serviceClient();
        const [plans, addons] = await Promise.all([
          db.from("subscription_plans").select("*").eq("is_active", true).eq("is_public", true).order("sort_order"),
          db.from("subscription_addons").select("*").eq("is_active", true).order("sort_order"),
        ]);
        if (plans.error) return json({ error: plans.error.message }, 500);
        return json({
          plans: plans.data ?? [],
          addons: addons.data ?? [],
          generated_at: new Date().toISOString(),
        });
      },
    },
  },
});