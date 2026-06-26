import { createFileRoute } from "@tanstack/react-router";
import { audit, json, preflight, requireKey, serviceClient } from "@/lib/api-server";

export const Route = createFileRoute("/api/public/v1/incidents")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "incidents:read");
        if (!auth.ok) return auth.res;
        const { data, error } = await serviceClient()
          .from("incidents")
          .select("id,code,severity,status,address,pickup_lat,pickup_lng,symptoms,assigned_ambulance_id,created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return json({ error: error.message }, 500);
        return json(data);
      },
      POST: async ({ request }) => {
        const auth = await requireKey(request, "incidents:write");
        if (!auth.ok) return auth.res;
        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
        const sevMap: Record<string, number> = { code_red: 8, code_yellow: 20, routine: 60 };
        const sev = String(body.severity ?? "routine");
        if (!(sev in sevMap)) return json({ error: "severity must be code_red | code_yellow | routine" }, 400);
        if (typeof body.pickup_lat !== "number" || typeof body.pickup_lng !== "number") return json({ error: "pickup_lat and pickup_lng are required numbers" }, 400);
        const { data, error } = await serviceClient().from("incidents").insert({
          caller_name: (body.caller_name as string) ?? null,
          caller_phone: (body.caller_phone as string) ?? null,
          patient_name: (body.patient_name as string) ?? null,
          address: (body.address as string) ?? null,
          pickup_lat: body.pickup_lat,
          pickup_lng: body.pickup_lng,
          severity: sev as "code_red" | "code_yellow" | "routine",
          symptoms: (body.symptoms as string) ?? null,
          requested_by: auth.ownerId,
          sla_target_at: new Date(Date.now() + sevMap[sev]! * 60_000).toISOString(),
        }).select().single();
        if (error) return json({ error: error.message }, 500);
        await audit(auth.ownerId, "incident.created", "incident", data.id, { source: "public_api", severity: sev });
        return json(data, 201);
      },
    },
  },
});