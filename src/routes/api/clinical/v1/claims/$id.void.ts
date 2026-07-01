import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { canTransitionClaim, type ClaimStatus } from "@/lib/rcm/claim-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */

const Body = z.object({ reason: z.string().min(3).max(500) });
const parse = parseBody((r) => Body.parse(r));

export const Route = createFileRoute("/api/clinical/v1/claims/$id/void")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const owned = await loadOwned<any>("claim", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;

      const from = owned.row.status as ClaimStatus;
      if (!canTransitionClaim(from, "closed")) {
        return envelope(`Cannot void from ${from}`, "invalid_state", 409);
      }
      const db = serviceClient() as any;
      const { data, error } = await db.from("claim").update({
        status: "closed", updated_by: auth.ctx.userId,
      }).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await db.from("claim_lifecycle_event").insert({
        tenant_id: auth.ctx.tenantId, claim_id: params.id,
        from_status: from, to_status: "closed", actor_id: auth.ctx.userId, reason: parsed.data.reason,
      });
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "claim.void", "claim", params.id, { reason: parsed.data.reason });
      return jsonData({ data });
    },
  } },
});