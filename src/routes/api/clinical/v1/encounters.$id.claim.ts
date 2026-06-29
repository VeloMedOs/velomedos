import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole } from "@/lib/api-clinical";
import { ClaimAssembleRequest } from "@/lib/mds/schema/claims";
import { assembleClaim } from "@/lib/mds/claim-assembly";
import { JOURNEY_RANK } from "@/lib/mds/state-machine";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parse = parseBody((raw) => ClaimAssembleRequest.parse(raw ?? {}));

/**
 * POST /api/clinical/v1/encounters/:id/claim
 *
 * Assembles (or returns the existing) draft claim for the encounter.
 * Branches by reimbursement_model — IP requires a grouped DRG; OP/ER requires
 * at least one charge_item. Returns the materialised claim with items,
 * diagnoses, care team, supporting info and links.
 */
export const Route = createFileRoute("/api/clinical/v1/encounters/$id/claim")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["biller", "coder", "case_manager"]);
        if (!auth.ok) return auth.res;

        const owned = await loadOwned<{
          tenant_id: string;
          class: string;
          reimbursement_model: string;
          journey_state: string;
        }>(
          "encounter",
          params.id,
          auth.ctx.tenantId,
          "id, tenant_id, class, reimbursement_model, journey_state",
        );
        if (!owned.ok) return owned.res;

        const parsed = await parse(request);
        if (!parsed.ok) return parsed.res;

        const model = owned.row.reimbursement_model;
        const rank = JOURNEY_RANK[owned.row.journey_state as keyof typeof JOURNEY_RANK] ?? 0;

        if (model === "drg_bundled" && rank < JOURNEY_RANK.grouped) {
          return envelope(
            "Inpatient encounter must be grouped before claim assembly",
            "not_grouped",
            409,
            { journey_state: owned.row.journey_state },
          );
        }
        if (model !== "drg_bundled" && rank < JOURNEY_RANK.discharged) {
          return envelope(
            "Encounter must be discharged before claim assembly",
            "not_discharged",
            409,
            { journey_state: owned.row.journey_state },
          );
        }

        try {
          const result = await assembleClaim(params.id, {
            actorId: auth.ctx.userId,
            providerClaimNo: parsed.data.provider_claim_no,
            invoiceNo: parsed.data.invoice_no ?? null,
            claimType: parsed.data.claim_type,
            force: parsed.data.force ?? false,
          });
          await clinicalAudit(
            auth.ctx.userId,
            auth.ctx.tenantId,
            "claim.assemble",
            "encounter",
            params.id,
            { claim_id: result.claim.id, model: result.claim.billing_model },
          );
          return jsonData({ data: result });
        } catch (e) {
          return envelope(
            e instanceof Error ? e.message : "claim assembly failed",
            "assemble_error",
            422,
          );
        }
      },
    },
  },
});