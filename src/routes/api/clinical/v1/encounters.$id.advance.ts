import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { EncounterAdvance } from "@/lib/mds/schema/encounter";
import {
  assertEncounterTransition,
  EncounterTransitionError,
  TERMINAL_ENCOUNTER_STATUSES,
  type EncounterClinicalStatus,
} from "@/lib/mds/state-machine";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

const parseAdvance = parseBody((raw) => EncounterAdvance.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/advance")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["nurse", "physician", "case_manager"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseAdvance(request);
        if (!parsed.ok) return parsed.res;

        const owned = await loadOwned<{ tenant_id: string; status: string }>(
          "encounter", params.id, auth.ctx.tenantId, "id, tenant_id, status",
        );
        if (!owned.ok) return owned.res;

        const from = owned.row.status as EncounterClinicalStatus;
        const to = parsed.data.to;
        try {
          assertEncounterTransition(from, to);
        } catch (e) {
          if (e instanceof EncounterTransitionError) {
            return envelope(e.message, "illegal_transition", 409, { from: e.from, to: e.to });
          }
          throw e;
        }

        const update: Record<string, unknown> = { status: to, updated_by: auth.ctx.userId };
        if (TERMINAL_ENCOUNTER_STATUSES.has(to)) {
          update.period_end = parsed.data.period_end ?? new Date().toISOString();
        }

        const db = serviceClient();
        const { data, error } = await db.from("encounter").update(update)
          .eq("id", params.id).select("*").single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "encounter.advance", "encounter", params.id, {
          from, to, reason: parsed.data.reason ?? null,
        });
        return jsonData({ data, from, to });
      },
    },
  },
});