import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";

/**
 * Public aggregate counters — no PII, no auth required.
 * Powers the marketing-site trust strip and the developer "try-it" examples.
 */
export const Route = createFileRoute("/api/public/v1/stats")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async () => {
        const sb = serviceClient();
        const [fleet, incidents, expiring, clinics] = await Promise.all([
          sb.from("ambulances").select("id,status", { count: "exact", head: false }),
          sb.from("incidents").select("id,status", { count: "exact", head: false }).in("status", ["pending", "assigned", "en_route", "on_scene", "transporting"]),
          sb.from("credentials").select("id", { count: "exact", head: true }).lte("expires_at", new Date(Date.now() + 7 * 24 * 3600_000).toISOString()),
          sb.from("clinics").select("id", { count: "exact", head: true }),
        ]);
        const fleetRows = fleet.data ?? [];
        const branches = 5; // org-wide branch count, fixed for v1
        return json({
          branches_live: branches,
          active_cases: incidents.count ?? incidents.data?.length ?? 0,
          teams_live: fleetRows.filter((r) => r.status !== "out_of_service").length,
          credentials_expiring_7d: expiring.count ?? 0,
          clinics_live: clinics.count ?? 0,
          generated_at: new Date().toISOString(),
        });
      },
    },
  },
});