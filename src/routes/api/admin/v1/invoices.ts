import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireAdmin, serviceClient } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/invoices")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "billing:read"); if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient().from("portal_invoices").select("*").order("issued_at", { ascending: false }).limit(500);
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ invoices: data });
      },
    },
  },
});