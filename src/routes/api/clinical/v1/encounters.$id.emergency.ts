import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { EmergencyUpsert } from "@/lib/mds/schema/hospitalization";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parseUpsert = parseBody((raw) => EmergencyUpsert.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/emergency")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const db = serviceClient() as any;
        const { data, error } = await db.from("encounter_emergency")
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
        if (owned.row.class !== "EMER") {
          return envelope("Emergency MDS only applies to EMER encounters", "class_forbidden", 409,
            { class: owned.row.class });
        }
        const parsed = await parseUpsert(request);
        if (!parsed.ok) return parsed.res;
        const db = serviceClient() as any;
        const { data, error } = await db.from("encounter_emergency")
          .upsert({
            ...parsed.data,
            encounter_id: params.id,
            tenant_id: auth.ctx.tenantId,
            created_by: auth.ctx.userId,
            updated_by: auth.ctx.userId,
          }, { onConflict: "encounter_id" })
          .select("*").single();
        if (error) return envelope(error.message, "db_error", 400);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter.emergency.upsert", "encounter", params.id);
        return jsonData({ data });
      },
    },
  },
});