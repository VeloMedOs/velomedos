import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/homecare/visits")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "homecare:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        let q = serviceClient().from("care_visits").select("*").order("scheduled_start", { ascending: true }).limit(500);
        const date = url.searchParams.get("date");
        const status = url.searchParams.get("status");
        const caregiver = url.searchParams.get("caregiver_id");
        const recipient = url.searchParams.get("recipient_id");
        if (date) {
          const start = new Date(date + "T00:00:00Z").toISOString();
          const end = new Date(date + "T23:59:59Z").toISOString();
          q = q.gte("scheduled_start", start).lte("scheduled_start", end);
        }
        if (status) q = q.eq("status", status as never);
        if (caregiver) q = q.eq("caregiver_id", caregiver);
        if (recipient) q = q.eq("recipient_id", recipient);
        const { data, error } = await q;
        if (error) { console.error("public_api homecare.visits GET", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
      POST: async ({ request }) => {
        const auth = await requireKey(request, "homecare:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => ({} as Record<string, unknown>));
        const { data, error } = await serviceClient().from("care_visits").insert(body as never).select("*").single();
        if (error) { console.error("public_api homecare.visits POST", error); return json({ error: error.message }, 400); }
        return json(data, 201);
      },
    },
  },
});