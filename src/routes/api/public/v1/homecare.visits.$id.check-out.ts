import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, requireKey, resolveTenantScope, serviceClient } from "@/lib/api-server";
import { z } from "zod";

const CheckOutBody = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  notes: z.string().max(4000).optional(),
  vitals: z.array(z.object({
    type: z.string().min(1).max(100),
    value: z.string().min(1).max(200),
    unit: z.string().max(50).optional(),
  })).max(50).optional(),
  medications: z.array(z.object({
    drug_name: z.string().min(1).max(300),
    dose: z.string().max(200).optional(),
    route: z.string().max(100).optional(),
    status: z.enum(["administered", "omitted", "held"]).optional(),
  })).max(50).optional(),
  tasks: z.array(z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(500),
    completed: z.boolean(),
  })).max(100).optional(),
});

/** POST body: { lat, lng, notes?, tasks?: [{id?, title, completed}],
 *               vitals?: [{type,value,unit?}], medications?: [{drug_name,dose?,route?,status?}] } */
export const Route = createFileRoute("/api/public/v1/homecare/visits/$id/check-out")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireKey(request, "homecare:write");
        if (!auth.ok) return auth.res;
        const scope = await resolveTenantScope(auth.auth, request);
        if (!scope.ok) return scope.res;
        const raw = await request.json().catch(() => null);
        const parsed = CheckOutBody.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "validation_failed", issues: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message })) }, 400);
        }
        const body = parsed.data;
        const lat = body.lat; const lng = body.lng;
        const db = serviceClient();
        const { data: existing } = await db.from("care_visits").select("id, tenant_id").eq("id", params.id).maybeSingle();
        if (!existing) return json({ error: "not_found" }, 404);
        if (existing.tenant_id !== scope.tenantId) return json({ error: "tenant_forbidden" }, 403);
        const { data: visit, error } = await db
          .from("care_visits")
          .update({
            status: "completed",
            check_out_at: new Date().toISOString(),
            check_out_lat: lat,
            check_out_lng: lng,
            notes: body.notes ?? undefined,
          })
          .eq("id", params.id)
          .eq("tenant_id", scope.tenantId)
          .select("*")
          .single();
        if (error || !visit) { console.error("homecare.check-out", error); return json({ error: error?.message ?? "failed" }, 400); }

        // Persist task completions / vitals / MAR if supplied — ownership-checked per row.
        if (Array.isArray(body.tasks) && body.tasks.length) {
          for (const t of body.tasks) {
            if (t.id) {
              await db.from("care_visit_tasks")
                .update({ completed: !!t.completed, completed_at: t.completed ? new Date().toISOString() : null })
                .eq("id", t.id)
                .eq("care_visit_id", visit.id);
            } else if (t.title) {
              await db.from("care_visit_tasks").insert({ care_visit_id: visit.id, title: t.title, completed: !!t.completed, completed_at: t.completed ? new Date().toISOString() : null });
            }
          }
        }
        if (Array.isArray(body.vitals) && body.vitals.length) {
          await db.from("care_visit_vitals").insert(body.vitals.map((v: any) => ({ care_visit_id: visit.id, type: v.type, value: v.value, unit: v.unit ?? null })));
        }
        if (Array.isArray(body.medications) && body.medications.length) {
          await db.from("medication_administrations").insert(body.medications.map((m: any) => ({
            care_visit_id: visit.id, drug_name: m.drug_name, dose: m.dose ?? null, route: m.route ?? null,
            status: m.status ?? "administered", administered_at: new Date().toISOString(),
          })));
        }

        // Emit usage event when EVV-verified.
        if (visit.evv_verified) {
          try { console.info("[usage] homecare.visit.verified", { visit_id: visit.id, tenant_id: visit.tenant_id }); } catch {}
        }

        return json({
          ok: true,
          visit_id: visit.id,
          status: visit.status,
          evv_verified: visit.evv_verified,
          evv_exception: visit.evv_exception,
          distance_m: visit.check_in_distance_m,
          usage_emitted: visit.evv_verified ? "homecare.visit.verified" : null,
        });
      },
    },
  },
});