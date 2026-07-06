import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const Body = z.object({ reason: z.string().min(3).max(500) });
const parse = parseBody((r) => Body.parse(r));

/**
 * POST /api/clinical/v1/claims/:id/resubmit — clones a rejected/resubmit_required
 * claim into a new draft linked via `replaces_claim_id`. Child rows copied.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/resubmit")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.remit" });
      if (!auth.ok) return auth.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const owned = await loadOwned<any>("claim", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      if (!["rejected", "resubmit_required"].includes(String(owned.row.status))) {
        return envelope(`Only rejected / resubmit_required claims can be resubmitted (found ${owned.row.status})`, "invalid_state", 409);
      }
      const db = serviceClient() as any;
      const src = owned.row;
      const seq = Date.now().toString().slice(-8);

      const { data: fresh, error } = await db.from("claim").insert({
        tenant_id: auth.ctx.tenantId,
        encounter_id: src.encounter_id,
        coverage_id: src.coverage_id,
        drg_assignment_id: src.drg_assignment_id,
        replaces_claim_id: src.id,
        provider_claim_no: `${src.provider_claim_no}-R${seq}`,
        invoice_no: src.invoice_no,
        claim_type: src.claim_type,
        claim_subtype: src.claim_subtype,
        billing_model: src.billing_model,
        total_net_minor: src.total_net_minor,
        total_patient_share_minor: src.total_patient_share_minor,
        total_payer_share_minor: src.total_payer_share_minor,
        currency: src.currency,
        status: "draft",
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);

      for (const table of ["claim_item","claim_diagnosis","claim_care_team","claim_supporting_info","claim_item_link"] as const) {
        const { data: children } = await db.from(table).select("*").eq("claim_id", src.id);
        if (children && children.length) {
          const rewritten = (children as any[]).map(({ id: _id, created_at: _c, updated_at: _u, ...rest }) => ({
            ...rest, claim_id: fresh.id, tenant_id: auth.ctx.tenantId,
          }));
          await db.from(table).insert(rewritten);
        }
      }

      await db.from("claim_lifecycle_event").insert({
        tenant_id: auth.ctx.tenantId, claim_id: fresh.id,
        from_status: null, to_status: "draft", actor_id: auth.ctx.userId,
        reason: parsed.data.reason, payload: { replaces_claim_id: src.id },
      });
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "claim.resubmit", "claim", fresh.id,
        { replaces_claim_id: src.id, reason: parsed.data.reason });
      return jsonData({ data: fresh });
    },
  } },
});