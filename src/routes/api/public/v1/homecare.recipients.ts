import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, resolveTenantScope, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/homecare/recipients")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "homecare:read");
        if (!auth.ok) return auth.res;
        const scope = await resolveTenantScope(auth.auth, request);
        if (!scope.ok) return scope.res;
        const { data, error } = await serviceClient()
          .from("care_recipients")
          .select("*")
          .eq("tenant_id", scope.tenantId)
          .order("full_name")
          .limit(500);
        if (error) { console.error("public_api homecare.recipients", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
    },
  },
});