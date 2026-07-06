import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { GrouperRunRequest } from "@/lib/mds/schema/coding";
import { buildGrouperMds, callGrouper } from "@/lib/mds/grouper";
import { JOURNEY_RANK } from "@/lib/mds/state-machine";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parseRun = parseBody((raw) => GrouperRunRequest.parse(raw ?? {}));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/group")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["coder", "physician", "case_manager"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{
          tenant_id: string; class: string; journey_state: string;
        }>("encounter", params.id, auth.ctx.tenantId,
          "id, tenant_id, class, journey_state");
        if (!owned.ok) return owned.res;
        if ((owned.row.class ?? "").toUpperCase() !== "IMP") {
          return envelope("Grouper only applies to inpatient (IMP) encounters",
            "class_forbidden", 409, { class: owned.row.class });
        }
        const rank = JOURNEY_RANK[owned.row.journey_state as keyof typeof JOURNEY_RANK] ?? 0;
        if (rank < JOURNEY_RANK.coded) {
          return envelope("Encounter must be coded before grouping",
            "not_coded", 409, { journey_state: owned.row.journey_state });
        }

        // Body is optional; default to {}
        let force = false;
        const ct = request.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          const parsed = await parseRun(request);
          if (!parsed.ok) return parsed.res;
          force = Boolean(parsed.data.force);
        }

        const db = serviceClient() as any;

        if (!force) {
          const { data: existing } = await db.from("drg_assignment")
            .select("*").eq("encounter_id", params.id).eq("status", "assigned").maybeSingle();
          if (existing) return jsonData({ data: existing, idempotent: true });
        }

        const mds = await buildGrouperMds(params.id);
        let result;
        try {
          result = await callGrouper(mds, auth.ctx.tenantId);
        } catch (e) {
          return envelope(e instanceof Error ? e.message : "grouper failed",
            "grouper_error", 502);
        }
        if (!result.drg_code) {
          return envelope("Grouper returned no DRG code", "grouper_empty", 502);
        }

        // Best-effort drg_id lookup by (drg_code, version)
        const { data: drgRef } = await db.from("drg")
          .select("id")
          .eq("drg_code", result.drg_code)
          .eq("version", result.drg_version)
          .maybeSingle();

        const { data, error } = await db.from("drg_assignment").insert({
          tenant_id: auth.ctx.tenantId,
          encounter_id: params.id,
          drg_id: drgRef?.id ?? null,
          drg_code: result.drg_code,
          drg_version: result.drg_version,
          mdc: result.mdc,
          adrg: result.adrg,
          partition: result.partition,
          complexity_score: result.complexity_score,
          grouper_name: result.grouper_name,
          grouper_version: result.grouper_version,
          grouper_request: mds,
          grouper_response: result.raw,
          status: "assigned",
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        }).select("*").single();
        if (error) return envelope("database_error", "db_error", 400);

        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter.group", "encounter", params.id, {
          drg_code: result.drg_code, drg_version: result.drg_version, force,
        });
        return jsonData({ data });
      },
    },
  },
});