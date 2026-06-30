import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, resolveTenantScope, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/homecare/visits/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "homecare:read");
        if (!auth.ok) return auth.res;
        const scope = await resolveTenantScope(auth.auth, request);
        if (!scope.ok) return scope.res;
        const db = serviceClient();
        const { data: visit, error } = await db
          .from("care_visits")
          .select("*")
          .eq("id", params.id)
          .eq("tenant_id", scope.tenantId)
          .maybeSingle();
        if (error) { console.error("public_api homecare.visits.$id", error); return json({ error: "internal_error" }, 500); }
        if (!visit) return json({ error: "not_found" }, 404);
        const [{ data: tasks }, { data: vitals }, { data: mar }] = await Promise.all([
          db.from("care_visit_tasks").select("*").eq("care_visit_id", params.id),
          db.from("care_visit_vitals").select("*").eq("care_visit_id", params.id),
          db.from("medication_administrations").select("*").eq("care_visit_id", params.id),
        ]);
        return json({ ...visit, tasks: tasks ?? [], vitals: vitals ?? [], medications: mar ?? [] });
      },
    },
  },
});