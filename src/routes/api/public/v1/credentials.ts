import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/credentials")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "compliance:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const expiringDays = Number(url.searchParams.get("expiring_in_days") ?? "");
        const db = serviceClient();
        // Tenant scoping: user-linked credentials are restricted to callers
        // whose API key is bound to a tenant, filtered via tenant_members.
        // Ambulance-linked credentials remain fleet-global by product design.
        let userIds: string[] = [];
        if (auth.tenantId) {
          const { data: members } = await db
            .from("tenant_members")
            .select("user_id")
            .eq("tenant_id", auth.tenantId);
          userIds = (members ?? []).map((m) => m.user_id as string);
        }
        // Build the OR filter: ambulance-linked (global) OR user-linked in tenant.
        const userFilter = userIds.length
          ? `subject_user_id.in.(${userIds.join(",")})`
          : null;
        let q = db
          .from("credentials")
          .select("id,kind,subject_user_id,subject_ambulance_id,reference,issuer,issued_on,expires_on")
          .order("expires_on");
        q = userFilter
          ? q.or(`subject_ambulance_id.not.is.null,${userFilter}`)
          : q.not("subject_ambulance_id", "is", null);
        if (Number.isFinite(expiringDays) && expiringDays > 0) {
          const cutoff = new Date(Date.now() + expiringDays * 86_400_000).toISOString().slice(0, 10);
          q = q.lte("expires_on", cutoff);
        }
        const { data, error } = await q;
        if (error) { console.error("public_api", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
    },
  },
});