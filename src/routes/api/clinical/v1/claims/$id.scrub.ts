import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { scrubClaimById } from "@/lib/rcm/claim-scrubber";
import { canTransitionClaim, type ClaimStatus } from "@/lib/rcm/claim-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */

const Body = z.object({ dry_run: z.boolean().optional() }).default({});
const parse = parseBody((r) => Body.parse(r ?? {}));

export const Route = createFileRoute("/api/clinical/v1/claims/$id/scrub")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("claim", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;

      const scrubbed = await scrubClaimById(params.id, auth.ctx.tenantId);
      if (!scrubbed.ok) return envelope(scrubbed.error, "scrub_error", 422);
      const { result } = scrubbed;
      const db = serviceClient() as any;

      if (!parsed.data.dry_run) {
        await db.from("claim_scrub_result").insert({
          tenant_id: auth.ctx.tenantId, claim_id: params.id, actor_id: auth.ctx.userId,
          blocker_count: result.blockers.length, warning_count: result.warnings.length,
          blockers: result.blockers, warnings: result.warnings, hash: result.hash,
        });
        const from = owned.row.status as ClaimStatus;
        const to = result.next_status;
        if (from !== to && canTransitionClaim(from, to)) {
          await db.from("claim").update({ status: to, updated_by: auth.ctx.userId })
            .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId);
          await db.from("claim_lifecycle_event").insert({
            tenant_id: auth.ctx.tenantId, claim_id: params.id,
            from_status: from, to_status: to, actor_id: auth.ctx.userId,
            reason: "scrub", payload: { hash: result.hash, blocker_count: result.blockers.length },
          });
        }
      }

      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "claim.scrub", "claim", params.id,
        { dry_run: !!parsed.data.dry_run, hash: result.hash, blocker_count: result.blockers.length });
      return jsonData({ data: result });
    },
  } },
});