import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import { validateBatchClaims } from "@/lib/rcm/validation";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/batches/$id/submit")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: b } = await db.from("claim_batch").select("*").eq("id", params.id).maybeSingle();
      if (!b || b.tenant_id !== auth.ctx.tenantId) return envelope("not_found", "not_found", 404);
      if (b.status !== "open") return envelope(`Batch is ${b.status}, cannot submit`, "invalid_state", 409);
      const { data: claims } = await db.from("claim")
        .select("id, readiness_status, snapshot_locked_at, batch_id, status")
        .eq("batch_id", params.id).eq("tenant_id", auth.ctx.tenantId);
      if (!claims || claims.length === 0) return envelope("Batch has no claims", "empty_batch", 409);
      const issues = validateBatchClaims(claims as any[]);
      if (issues.length) return envelope("Batch not ready", "batch_not_ready", 409, { issues });
      await db.from("claim_batch").update({ status: "submitting", updated_by: auth.ctx.userId }).eq("id", params.id);
      const now = new Date().toISOString();
      const ids = (claims as any[]).map((c) => c.id);
      await db.from("claim").update({ status: "submitted", submitted_at: now }).in("id", ids);
      await db.from("claim_batch").update({ status: "submitted", submitted_at: now }).eq("id", params.id);
      for (const c of claims as any[]) {
        await db.from("claim_lifecycle_event").insert({
          tenant_id: auth.ctx.tenantId,
          claim_id: c.id,
          from_status: c.status,
          to_status: "submitted",
          actor_id: auth.ctx.userId,
          reason: `Batch ${b.batch_no} submitted`,
        });
      }
      return jsonData({ ok: true, submitted: ids.length });
    },
  } },
});