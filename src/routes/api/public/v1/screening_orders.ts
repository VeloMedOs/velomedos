import { createFileRoute } from "@tanstack/react-router";
import { audit, json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/screening_orders")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "screening:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("screening_orders")
          .select("id,corporate_account_id,candidate_name,candidate_id_ref,package_id,appointment_at,status,created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return json({ error: error.message }, 500);
        return json(data);
      },
      POST: async ({ request }) => {
        const auth = await requireKey(request, "screening:write");
        if (!auth.ok) return auth.res;
        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
        const required = ["corporate_account_id", "candidate_name", "package_id"] as const;
        for (const k of required) if (!body[k]) return json({ error: `Missing ${k}` }, 400);
        const { data, error } = await serviceClient().from("screening_orders").insert({
          corporate_account_id: body.corporate_account_id as string,
          candidate_name: body.candidate_name as string,
          candidate_id_ref: (body.candidate_id_ref as string) ?? null,
          package_id: body.package_id as string,
          appointment_at: (body.appointment_at as string) ?? null,
        }).select().single();
        if (error) return json({ error: error.message }, 500);
        await audit(auth.ownerId, "screening.order.created", "screening_order", data.id, { source: "public_api" });
        return json(data, 201);
      },
    },
  },
});