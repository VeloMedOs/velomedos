import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json, preflight, requireKey, resolveTenantScope, serviceClient } from "@/lib/api-server";

const PlanCreate = z.object({
  recipient_id: z.string().uuid(),
  plan_type: z.string().min(1),
  frequency: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().nullable().optional(),
  assigned_team_id: z.string().uuid().nullable().optional(),
  required_skills: z.array(z.string()).optional(),
  notes: z.string().max(4000).nullable().optional(),
  tasks: z.array(z.object({
    title: z.string().min(1),
    instructions: z.string().nullable().optional(),
    requires_vitals: z.boolean().optional(),
  })).optional(),
}).strict();

export const Route = createFileRoute("/api/public/v1/homecare/care-plans")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "homecare:read");
        if (!auth.ok) return auth.res;
        const scope = await resolveTenantScope(auth.auth, request);
        if (!scope.ok) return scope.res;
        const url = new URL(request.url);
        let q = serviceClient()
          .from("care_plans")
          .select("*, care_plan_tasks(*)")
          .eq("tenant_id", scope.tenantId)
          .order("created_at", { ascending: false })
          .limit(500);
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
        const scope = await resolveTenantScope(auth.auth, request);
        if (!scope.ok) return scope.res;
        const raw = await request.json().catch(() => ({}));
        const parsed = PlanCreate.safeParse(raw);
        if (!parsed.success) return json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
        const { tasks, ...planFields } = parsed.data;
        const db = serviceClient();
        // Recipient must belong to the caller's tenant — prevents cross-tenant plan creation.
        const { data: rec } = await db.from("care_recipients").select("tenant_id").eq("id", planFields.recipient_id).maybeSingle();
        if (!rec || rec.tenant_id !== scope.tenantId) return json({ error: "recipient_not_in_tenant" }, 403);
        const insert = {
          ...planFields,
          tenant_id: scope.tenantId,
          required_skills: planFields.required_skills ?? [],
          status: "active",
          created_by: auth.auth.via === "session" ? auth.auth.ownerId : null,
        };
        const { data: plan, error } = await db.from("care_plans").insert(insert as never).select("*").single();
        if (error || !plan) { console.error("public_api homecare.care-plans POST", error); return json({ error: error?.message ?? "insert_failed" }, 400); }
        if (tasks?.length) {
          await db.from("care_plan_tasks").insert(tasks.map((t) => ({
            care_plan_id: plan.id,
            title: t.title,
            instructions: t.instructions ?? null,
            requires_vitals: !!t.requires_vitals,
          })));
        }
        return json(plan, 201);
      },
    },
  },
});