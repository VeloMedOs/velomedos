import { createFileRoute } from "@tanstack/react-router";
import { adminDb, json, preflight, requireAdmin } from "@/lib/api-admin";

export const Route = createFileRoute("/api/admin/v1/usage/daily")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireAdmin(request, "analytics:read"); if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const sid = url.searchParams.get("subscriber_id");
        const days = Math.min(Number(url.searchParams.get("days") ?? 60), 365);
        const since = new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10);
        let q = adminDb().from("portal_usage_daily").select("*").gte("day", since).order("day", { ascending: true });
        if (sid) q = q.eq("subscriber_id", sid);
        const { data, error } = await q;
        if (error) return json({ error: error.message, code: "db/read_failed", request_id: crypto.randomUUID() }, 500);
        return json({ usage: data });
      },
    },
  },
});