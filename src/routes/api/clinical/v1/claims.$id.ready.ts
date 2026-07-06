import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "./_helpers";
import { loadClaimReadinessBundle } from "@/lib/mds/claim-loader";
import { validateClaimReadiness } from "@/lib/mds/validation";
import { validateClaimRcmReadiness } from "@/lib/rcm/validation";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/clinical/v1/claims/:id/ready
 *
 * Transitions a draft claim → ready (biller QA gate before submission).
 * Triggers encounter journey advance to `claim_ready` via the DB trigger.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/ready")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["biller", "case_manager"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<{ tenant_id: string; status: string }>(
          "claim",
          params.id,
          auth.ctx.tenantId,
          "id, tenant_id, status",
        );
        if (!owned.ok) return owned.res;
        if (owned.row.status !== "draft") {
          return envelope(
            `Claim cannot transition to ready from ${owned.row.status}`,
            "bad_status",
            409,
          );
        }

        // Phase 10 — strict MDS + RCM gates
        const loaded = await loadClaimReadinessBundle(params.id, auth.ctx.tenantId);
        if (!loaded.ok) return envelope(loaded.reason, "not_found", 404);
        const clinical = validateClaimReadiness(loaded.bundle);
        if (!clinical.ok) {
          return envelope(
            "Claim is not MDS-complete",
            "mds_incomplete",
            422,
            { missing: clinical.missing, drg: clinical.drg },
          );
        }
        const rcm = validateClaimRcmReadiness(loaded.bundle);
        if (!rcm.ok) {
          return envelope(
            "Claim is not RCM-complete",
            "rcm_incomplete",
            422,
            { missing: rcm.missing, rcm: rcm.flags },
          );
        }

        const db = serviceClient() as any;
        const { data, error } = await db
          .from("claim")
          .update({ status: "ready", updated_by: auth.ctx.userId })
          .eq("id", params.id)
          .select("*")
          .single();
        if (error) return envelope("database_error", "db_error", 400);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "claim.ready", "claim", params.id);
        return jsonData({ data });
      },
    },
  },
});