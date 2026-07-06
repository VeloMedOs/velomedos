import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { CodingFinalize } from "@/lib/mds/schema/coding";
import { JOURNEY_RANK } from "@/lib/mds/state-machine";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parseFinalize = parseBody((raw) => CodingFinalize.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/code")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string }>("encounter", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const db = serviceClient() as any;
        const { data, error } = await db.from("clinical_coding")
          .select("*").eq("encounter_id", params.id).maybeSingle();
        if (error) return envelope("database_error", "db_error", 500);
        return jsonData({ data });
      },
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["coder", "physician", "case_manager"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{
          tenant_id: string; class: string; journey_state: string;
        }>("encounter", params.id, auth.ctx.tenantId,
          "id, tenant_id, class, journey_state");
        if (!owned.ok) return owned.res;
        if ((owned.row.class ?? "").toUpperCase() !== "IMP") {
          return envelope("Coding only applies to inpatient (IMP) encounters",
            "class_forbidden", 409, { class: owned.row.class });
        }
        const rank = JOURNEY_RANK[owned.row.journey_state as keyof typeof JOURNEY_RANK] ?? 0;
        if (rank < JOURNEY_RANK.discharged) {
          return envelope("Encounter must be discharged before coding",
            "not_discharged", 409, { journey_state: owned.row.journey_state });
        }

        const db = serviceClient() as any;
        const { data: principal, error: dxErr } = await db.from("encounter_diagnosis")
          .select("id, role").eq("encounter_id", params.id).eq("role", "principal").maybeSingle();
        if (dxErr) return envelope(dxErr.message, "db_error", 500);
        if (!principal) {
          return envelope("Encounter is missing a principal diagnosis",
            "missing_principal_dx", 409);
        }

        const parsed = await parseFinalize(request);
        if (!parsed.ok) return parsed.res;
        const body = parsed.data;
        if (body.principal_diagnosis_id !== principal.id) {
          return envelope("principal_diagnosis_id does not match encounter principal Dx",
            "principal_dx_mismatch", 409,
            { expected: principal.id, received: body.principal_diagnosis_id });
        }

        const { data: existing } = await db.from("clinical_coding")
          .select("id, status").eq("encounter_id", params.id).maybeSingle();

        const row = {
          tenant_id: auth.ctx.tenantId,
          encounter_id: params.id,
          coder_id: auth.ctx.userId,
          principal_diagnosis_id: body.principal_diagnosis_id,
          notes: body.notes ?? null,
          status: existing?.status === "coded" ? "amended" : "coded",
          coded_at: new Date().toISOString(),
          updated_by: auth.ctx.userId,
          created_by: existing ? undefined : auth.ctx.userId,
        };

        const { data, error } = await db.from("clinical_coding")
          .upsert(row, { onConflict: "encounter_id" })
          .select("*").single();
        if (error) return envelope("database_error", "db_error", 400);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter.code", "encounter", params.id);
        return jsonData({ data });
      },
    },
  },
});