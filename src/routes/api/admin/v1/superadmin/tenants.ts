import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/superadmin/tenants")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "tenants:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await adminDb()
          .from("corporate_accounts")
          .select("id, company_name, slug, tenant_type, tenant_lifecycle, country, created_at")
          .order("created_at", { ascending: false });
        if (error) return json({ error: "database_error", code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ tenants: data ?? [] });
      },
    },
  },
});