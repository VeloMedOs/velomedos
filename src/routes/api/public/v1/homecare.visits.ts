import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json, preflight, requireKey, resolveTenantScope, serviceClient } from "@/lib/api-server";

/** Client-controllable fields only — tenant_id, evv_verified, check_in_* and check_out_*
 *  are server-controlled to prevent mass-assignment / EVV fraud. */
const VisitCreate = z.object({
  care_plan_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  caregiver_id: z.string().uuid().nullable().optional(),
  scheduled_start: z.string().min(1),
  scheduled_end: z.string().min(1),
  status: z.enum(["scheduled", "checked_in", "completed", "missed", "cancelled"]).optional(),
  notes: z.string().max(4000).nullable().optional(),
}).strict();

export const Route = createFileRoute("/api/public/v1/homecare/visits")({
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
          .from("care_visits")
          .select("*")
          .eq("tenant_id", scope.tenantId)
          .order("scheduled_start", { ascending: true })
          .limit(500);
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
        const scope = await resolveTenantScope(auth.auth, request);
        if (!scope.ok) return scope.res;
        const raw = await request.json().catch(() => ({}));
        const parsed = VisitCreate.safeParse(raw);
        if (!parsed.success) return json({ error: "invalid_body", issues: parsed.error.flatten() }, 400);
        const db = serviceClient();
        // Ownership: care_plan + recipient must belong to caller's tenant.
        const [{ data: plan }, { data: rec }] = await Promise.all([
          db.from("care_plans").select("tenant_id").eq("id", parsed.data.care_plan_id).maybeSingle(),
          db.from("care_recipients").select("tenant_id").eq("id", parsed.data.recipient_id).maybeSingle(),
        ]);
        if (!plan || plan.tenant_id !== scope.tenantId) return json({ error: "care_plan_not_in_tenant" }, 403);
        if (!rec || rec.tenant_id !== scope.tenantId) return json({ error: "recipient_not_in_tenant" }, 403);
        const insert = { ...parsed.data, tenant_id: scope.tenantId, evv_verified: false };
        const { data, error } = await db.from("care_visits").insert(insert as never).select("*").single();
        if (error) { console.error("public_api homecare.visits POST", error); return json({ error: error.message }, 400); }
        return json(data, 201);
      },
    },
  },
});