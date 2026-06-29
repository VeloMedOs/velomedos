import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { HospitalizationUpsert } from "@/lib/mds/schema/hospitalization";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parseUpsert = parseBody((raw) => HospitalizationUpsert.parse(raw));
const ADMIT_CLASSES = new Set(["IMP", "HH"]);

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/admit")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const db = serviceClient() as any;
        const { data, error } = await db.from("encounter_hospitalization")
          .select("*").eq("encounter_id", params.id).maybeSingle();
        if (error) return envelope(error.message, "db_error", 500);
        return jsonData({ data });
      },
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["nurse", "physician", "case_manager"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string; class: string }>(
          "encounter", params.id, auth.ctx.tenantId, "id, tenant_id, class",
        );
        if (!owned.ok) return owned.res;
        if (!ADMIT_CLASSES.has(owned.row.class)) {
          return envelope("Admission only applies to IMP or HH encounters", "class_forbidden", 409,
            { class: owned.row.class });
        }
        const parsed = await parseUpsert(request);
        if (!parsed.ok) return parsed.res;
        const body = parsed.data as Record<string, unknown>;
        if (!body.admitted_at) body.admitted_at = new Date().toISOString();
        const db = serviceClient() as any;
        const { data, error } = await db.from("encounter_hospitalization")
          .upsert({
            ...body,
            encounter_id: params.id,
            tenant_id: auth.ctx.tenantId,
            created_by: auth.ctx.userId,
            updated_by: auth.ctx.userId,
          }, { onConflict: "encounter_id" })
          .select("*").single();
        if (error) return envelope(error.message, "db_error", 400);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter.admit", "encounter", params.id);
        return jsonData({ data });
      },
    },
  },
});