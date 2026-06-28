import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/homecare/care-plans")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "homecare:read");
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        let q = serviceClient().from("care_plans").select("*, care_plan_tasks(*)").order("created_at", { ascending: false }).limit(500);
        const recipient = url.searchParams.get("recipient_id");
        const planType = url.searchParams.get("plan_type");
        const status = url.searchParams.get("status");
        if (recipient) q = q.eq("recipient_id", recipient);
        if (planType) q = q.eq("plan_type", planType as never);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) { console.error("public_api homecare.care-plans GET", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
      POST: async ({ request }) => {
        const auth = await requireKey(request, "homecare:write");
        if (!auth.ok) return auth.res;
        const body = await request.json().catch(() => ({} as Record<string, unknown>));
        const tasks = Array.isArray((body as any).tasks) ? (body as any).tasks : null;
        const { tasks: _drop, ...planRow } = body as any;
        const db = serviceClient();
        const { data: plan, error } = await db.from("care_plans").insert(planRow).select("*").single();
        if (error || !plan) { console.error("public_api homecare.care-plans POST", error); return json({ error: error?.message ?? "insert_failed" }, 400); }
        if (tasks?.length) {
          await db.from("care_plan_tasks").insert(tasks.map((t: any) => ({ ...t, care_plan_id: plan.id })));
        }
        return json(plan, 201);
      },
    },
  },
});