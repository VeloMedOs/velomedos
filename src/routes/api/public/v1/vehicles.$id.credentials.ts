import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/vehicles/$id/credentials")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireKey(request, "compliance:read");
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const [v, crew] = await Promise.all([
          db.from("credentials")
            .select("id,kind,reference,issuer,issued_on,expires_on,subject_user_id,subject_ambulance_id")
            .eq("subject_ambulance_id", params.id),
          db.from("ambulances").select("driver_id").eq("id", params.id).maybeSingle(),
        ]);
        let crewIds = [crew.data?.driver_id].filter(Boolean) as string[];
        // Scope crew credentials to the caller's tenant to prevent cross-tenant
        // user enumeration via the compliance:read scope.
        if (crewIds.length && auth.tenantId) {
          const { data: members } = await db
            .from("tenant_members")
            .select("user_id")
            .eq("tenant_id", auth.tenantId)
            .in("user_id", crewIds);
          crewIds = (members ?? []).map((m) => m.user_id as string);
        } else if (crewIds.length && !auth.tenantId) {
          // Portal-wide keys have no tenant binding; do not expose per-user PII.
          crewIds = [];
        }
        const crewCreds = crewIds.length
          ? (await db.from("credentials")
              .select("id,kind,reference,issuer,issued_on,expires_on,subject_user_id,subject_ambulance_id")
              .in("subject_user_id", crewIds)).data ?? []
          : [];
        return json({ vehicle: v.data ?? [], crew: crewCreds });
      },
    },
  },
});