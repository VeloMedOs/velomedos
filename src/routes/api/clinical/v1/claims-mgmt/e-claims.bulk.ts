import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Bulk actions on claims from the E-Claims worklist:
 *  - mark_ready        · readiness_status → ready
 *  - mark_hold         · readiness_status → hold  (with reason)
 *  - needs_correction  · readiness_status → needs_correction
 *  - detach_from_batch · only if batch.status = open
 *  - add_to_batch      · attach claims to an existing open batch
 */
const Body = z.object({
  action: z.enum(["mark_ready","mark_hold","needs_correction","detach_from_batch","add_to_batch"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  batch_id: z.string().uuid().optional(),
  reason: z.string().max(1000).optional(),
});

export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/e-claims/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const body = await parseBody((raw) => Body.parse(raw))(request);
      if (!body.ok) return body.res;
      const db = serviceClient() as any;
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      for (const id of body.data.ids) {
        try {
          const { data: c } = await db.from("claim").select("id, tenant_id, batch_id, readiness_status, coverage_id").eq("id", id).maybeSingle();
          if (!c || c.tenant_id !== auth.ctx.tenantId) throw new Error("not_found");
          if (body.data.action === "mark_ready") {
            await db.from("claim").update({ readiness_status: "ready", snapshot_locked_at: new Date().toISOString() }).eq("id", id);
          } else if (body.data.action === "mark_hold") {
            await db.from("claim").update({ readiness_status: "hold" }).eq("id", id);
          } else if (body.data.action === "needs_correction") {
            await db.from("claim").update({ readiness_status: "needs_correction" }).eq("id", id);
          } else if (body.data.action === "detach_from_batch") {
            if (!c.batch_id) throw new Error("not_in_batch");
            const { data: b } = await db.from("claim_batch").select("status").eq("id", c.batch_id).maybeSingle();
            if (b?.status !== "open") throw new Error(`batch_${b?.status ?? "missing"}`);
            await db.from("claim").update({ batch_id: null }).eq("id", id);
          } else if (body.data.action === "add_to_batch") {
            if (!body.data.batch_id) throw new Error("batch_id_required");
            const { data: b } = await db.from("claim_batch").select("id, status, payer_id, tenant_id").eq("id", body.data.batch_id).maybeSingle();
            if (!b || b.tenant_id !== auth.ctx.tenantId) throw new Error("batch_not_found");
            if (b.status !== "open") throw new Error(`batch_${b.status}`);
            if (c.batch_id) throw new Error("already_batched");
            await db.from("claim").update({ batch_id: b.id, readiness_status: "ready", snapshot_locked_at: new Date().toISOString() }).eq("id", id);
          }
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : "error" });
        }
      }
      // Recompute batch totals for any touched batches
      const batchIds = new Set<string>();
      if (body.data.batch_id) batchIds.add(body.data.batch_id);
      for (const id of body.data.ids) {
        const { data: c } = await db.from("claim").select("batch_id").eq("id", id).maybeSingle();
        if (c?.batch_id) batchIds.add(c.batch_id);
      }
      for (const bid of batchIds) {
        const { data: sums } = await db.from("claim").select("total_net_minor").eq("batch_id", bid);
        const total = (sums ?? []).reduce((s: number, r: any) => s + (r.total_net_minor ?? 0), 0);
        await db.from("claim_batch").update({ claim_count: (sums ?? []).length, total_amount_minor: total }).eq("id", bid);
      }
      return jsonData({ results });
    },
  } },
});