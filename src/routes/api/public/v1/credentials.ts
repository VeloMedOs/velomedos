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
        let q = serviceClient()
          .from("credentials")
          .select("id,kind,subject_user_id,subject_ambulance_id,reference,issuer,issued_on,expires_on")
          .order("expires_on");
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