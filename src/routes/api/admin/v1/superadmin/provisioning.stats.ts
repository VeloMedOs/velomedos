import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/provisioning/stats")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "provisioning:read");
        if (!auth.ok) return auth.res;
        const [{ data: reqs }, { data: tenants }] = await Promise.all([
          adminDb().from("tenant_provisioning_request").select("status"),
          adminDb().from("corporate_accounts").select("tenant_lifecycle, tenant_type"),
        ]);
        const byStatus: Record<string, number> = {};
        for (const r of (reqs ?? []) as { status: string }[]) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        const byLifecycle: Record<string, number> = {};
        const byType: Record<string, number> = {};
        for (const t of (tenants ?? []) as { tenant_lifecycle: string; tenant_type: string }[]) {
          byLifecycle[t.tenant_lifecycle] = (byLifecycle[t.tenant_lifecycle] ?? 0) + 1;
          byType[t.tenant_type] = (byType[t.tenant_type] ?? 0) + 1;
        }
        return json({ by_status: byStatus, by_lifecycle: byLifecycle, by_type: byType });
      },
    },
  },
});