import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { audit, json, preflight, requireKey, serviceClient } from "@/lib/api-server";

const createSchema = z.object({
  severity: z.enum(["code_red", "code_yellow", "routine"]),
  pickup_lat: z.number().min(-90).max(90),
  pickup_lng: z.number().min(-180).max(180),
  caller_name: z.string().trim().max(120).optional().nullable(),
  caller_phone: z.string().trim().max(40).optional().nullable(),
  patient_name: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  symptoms: z.string().trim().max(2000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/v1/incidents")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireKey(request, "incidents:read");
        if (!auth.ok) return auth.res;
        let q = serviceClient()
          .from("incidents")
          .select("id,code,severity,status,address,pickup_lat,pickup_lng,symptoms,assigned_ambulance_id,created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (auth.via === "key") q = q.eq("requested_by", auth.ownerId);
        const { data, error } = await q;
        if (error) { console.error("incidents.list", error); return json({ error: "internal_error" }, 500); }
        return json(data);
      },
      POST: async ({ request }) => {
        const auth = await requireKey(request, "incidents:write");
        if (!auth.ok) return auth.res;
        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) return json({ error: "invalid_input", issues: parsed.error.flatten() }, 400);
        const v = parsed.data;
        const sevMap = { code_red: 8, code_yellow: 20, routine: 60 } as const;
        const { data, error } = await serviceClient().from("incidents").insert({
          caller_name: v.caller_name ?? null,
          caller_phone: v.caller_phone ?? null,
          patient_name: v.patient_name ?? null,
          address: v.address ?? null,
          pickup_lat: v.pickup_lat,
          pickup_lng: v.pickup_lng,
          severity: v.severity,
          symptoms: v.symptoms ?? null,
          requested_by: auth.ownerId,
          sla_target_at: new Date(Date.now() + sevMap[v.severity] * 60_000).toISOString(),
        }).select().single();
        if (error) { console.error("incidents.create", error); return json({ error: "internal_error" }, 500); }
        await audit(auth.ownerId, "incident.created", "incident", data.id, { source: "public_api", severity: v.severity });
        return json(data, 201);
      },
    },
  },
});