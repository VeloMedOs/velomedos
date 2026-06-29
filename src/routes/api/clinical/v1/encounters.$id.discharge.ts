import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { DischargePayload } from "@/lib/mds/schema/hospitalization";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parseDischarge = parseBody((raw) => DischargePayload.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/discharge")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["nurse", "physician", "case_manager"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string; class: string; period_start: string | null }>(
          "encounter", params.id, auth.ctx.tenantId, "id, tenant_id, class, period_start",
        );
        if (!owned.ok) return owned.res;
        const parsed = await parseDischarge(request);
        if (!parsed.ok) return parsed.res;
        const body = parsed.data;

        const db = serviceClient() as any;

        // 1) Load existing hospitalization row (admitted_at needed for same_day)
        const { data: existing } = await db.from("encounter_hospitalization")
          .select("admitted_at").eq("encounter_id", params.id).maybeSingle();
        const admittedAt: string | null = existing?.admitted_at ?? null;
        const sameDay = admittedAt
          ? new Date(admittedAt).toISOString().slice(0, 10) === new Date(body.discharged_at).toISOString().slice(0, 10)
          : null;

        // 2) Update encounter MDS fields
        const { error: encErr } = await db.from("encounter")
          .update({
            separation_mode: body.separation_mode,
            mechanical_ventilation_hours: body.mechanical_ventilation_hours ?? null,
            cause_of_death: body.cause_of_death ?? null,
            same_day: sameDay,
            period_end: body.discharged_at,
            updated_by: auth.ctx.userId,
          })
          .eq("id", params.id);
        if (encErr) return envelope(encErr.message, "db_error", 500);

        // 3) Upsert hospitalization with discharge fields (triggers advance journey)
        const { data: hosp, error: hospErr } = await db.from("encounter_hospitalization")
          .upsert({
            encounter_id: params.id,
            tenant_id: auth.ctx.tenantId,
            discharged_at: body.discharged_at,
            discharge_specialty: body.discharge_specialty ?? null,
            discharge_disposition: body.discharge_disposition ?? null,
            created_by: auth.ctx.userId,
            updated_by: auth.ctx.userId,
          }, { onConflict: "encounter_id" })
          .select("*").single();
        if (hospErr) return envelope(hospErr.message, "db_error", 400);

        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter.discharge", "encounter", params.id, {
          separation_mode: body.separation_mode, same_day: sameDay,
        });
        return jsonData({ data: { hospitalization: hosp, same_day: sameDay } });
      },
    },
  },
});