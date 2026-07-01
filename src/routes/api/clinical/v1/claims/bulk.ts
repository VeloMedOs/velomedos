import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { jsonData, parseBody } from "../_helpers";
import { scrubClaimById } from "@/lib/rcm/claim-scrubber";
import { canTransitionClaim, type ClaimStatus } from "@/lib/rcm/claim-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */

const Body = z.object({
  action: z.enum(["scrub", "submit", "assign_me", "void"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().max(500).optional(),
});
const parse = parseBody((r) => Body.parse(r));

type Row = { id: string; ok: boolean; error?: string; hash?: string; next_status?: string };

export const Route = createFileRoute("/api/clinical/v1/claims/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const { action, ids, reason } = parsed.data;
      const db = serviceClient() as any;

      const { data: rows } = await db.from("claim").select("id, status")
        .in("id", ids).eq("tenant_id", auth.ctx.tenantId);
      const byId = new Map<string, any>(((rows ?? []) as any[]).map((r) => [r.id, r]));

      const results: Row[] = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (!row) { results.push({ id, ok: false, error: "not_found" }); continue; }
        try {
          if (action === "assign_me") {
            await db.from("claim").update({ locked_by: auth.ctx.userId, locked_at: new Date().toISOString(), updated_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            results.push({ id, ok: true });
          } else if (action === "scrub") {
            const s = await scrubClaimById(id, auth.ctx.tenantId);
            if (!s.ok) { results.push({ id, ok: false, error: s.error }); continue; }
            await db.from("claim_scrub_result").insert({
              tenant_id: auth.ctx.tenantId, claim_id: id, actor_id: auth.ctx.userId,
              blocker_count: s.result.blockers.length, warning_count: s.result.warnings.length,
              blockers: s.result.blockers, warnings: s.result.warnings, hash: s.result.hash,
            });
            const from = row.status as ClaimStatus;
            const to = s.result.next_status;
            if (from !== to && canTransitionClaim(from, to)) {
              await db.from("claim").update({ status: to, updated_by: auth.ctx.userId })
                .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
              await db.from("claim_lifecycle_event").insert({
                tenant_id: auth.ctx.tenantId, claim_id: id, from_status: from, to_status: to,
                actor_id: auth.ctx.userId, reason: "bulk_scrub", payload: { hash: s.result.hash },
              });
            }
            results.push({ id, ok: true, hash: s.result.hash, next_status: s.result.next_status });
          } else if (action === "submit") {
            const from = row.status as ClaimStatus;
            if (!canTransitionClaim(from, "submitted")) {
              results.push({ id, ok: false, error: `invalid_state: ${from} → submitted` });
              continue;
            }
            await db.from("claim").update({ status: "submitted", submitted_at: new Date().toISOString(), updated_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            await db.from("claim_lifecycle_event").insert({
              tenant_id: auth.ctx.tenantId, claim_id: id, from_status: from, to_status: "submitted",
              actor_id: auth.ctx.userId, reason: "bulk_submit",
            });
            results.push({ id, ok: true });
          } else if (action === "void") {
            const from = row.status as ClaimStatus;
            if (!canTransitionClaim(from, "closed")) {
              results.push({ id, ok: false, error: `invalid_state: ${from} → closed` });
              continue;
            }
            await db.from("claim").update({ status: "closed", updated_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            await db.from("claim_lifecycle_event").insert({
              tenant_id: auth.ctx.tenantId, claim_id: id, from_status: from, to_status: "closed",
              actor_id: auth.ctx.userId, reason: reason ?? "bulk_void",
            });
            results.push({ id, ok: true });
          }
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }

      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "claim.bulk", "claim", undefined,
        { action, count: ids.length, failed: results.filter((r) => !r.ok).length });
      return jsonData({ data: results });
    },
  } },
});