import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { audit, json, preflight, requireKey, serviceClient } from "@/lib/api-server";

const createSchema = z.object({
  corporate_account_id: z.string().uuid(),
  candidate_name: z.string().trim().min(1).max(120),
  package_id: z.string().uuid(),
  candidate_id_ref: z.string().trim().max(80).optional().nullable(),
  appointment_at: z.string().datetime().optional().nullable(),
});

export const Route = createFileRoute("/api/public/v1/screening_orders")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "screening:read");
        if (!auth.ok) return auth.res;
        let q = serviceClient()
          .from("screening_orders")
          .select("id,corporate_account_id,candidate_name,candidate_id_ref,package_id,appointment_at,status,created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (auth.via === "key") {
          if (!auth.tenantId) return json({ error: "tenant_scope_required" }, 403);
          q = q.eq("corporate_account_id", auth.tenantId);
        }
        const { data, error } = await q;
        if (error) { console.error("screening.list", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
      POST: async ({ request }) => {
        const auth = await requireKey(request, "screening:write");
        if (!auth.ok) return auth.res;
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
        const v = parsed.data;
        if (auth.via === "key") {
          if (!auth.tenantId) return json({ error: "tenant_scope_required" }, 403);
          if (v.corporate_account_id !== auth.tenantId) return json({ error: "forbidden_cross_tenant" }, 403);
        }
        const { data, error } = await serviceClient().from("screening_orders").insert({
          corporate_account_id: v.corporate_account_id,
          candidate_name: v.candidate_name,
          candidate_id_ref: v.candidate_id_ref ?? null,
          package_id: v.package_id,
          appointment_at: v.appointment_at ?? null,
        }).select().single();
        if (error) { console.error("screening.create", error); return json({ error: "internal_error" }, 500); }
        await audit(auth.ownerId, "screening.order.created", "screening_order", data.id, { source: "public_api" });
        return json(data, 201);
      },
    },
  },
});