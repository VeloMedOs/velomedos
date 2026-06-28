import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/homecare/recipients")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "homecare:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const q = serviceClient().from("care_recipients").select("*").order("full_name");
        const tenantId = url.searchParams.get("tenant_id");
        const { data, error } = await (tenantId ? q.eq("tenant_id", tenantId) : q).limit(500);
        if (error) { console.error("public_api homecare.recipients", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
    },
  },
});