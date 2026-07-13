import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/intake/stats")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "subscribers:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb().from("business_requests").select("stage, source");
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        const byStage: Record<string, number> = {};
        const bySource: Record<string, number> = {};
        for (const row of (data ?? []) as { stage: string; source: string }[]) {
          byStage[row.stage] = (byStage[row.stage] ?? 0) + 1;
          bySource[row.source] = (bySource[row.source] ?? 0) + 1;
        }
        return json({ total: data?.length ?? 0, by_stage: byStage, by_source: bySource });
      },
    },
  },
});