import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/audit")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "audit:read"); if (!auth.ok) return auth.res;
        const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 100), 500);
        const { data, error } = await adminDb().from("portal_audit").select("*").order("created_at", { ascending: false }).limit(limit);
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ audit: data });
      },
    },
  },
});