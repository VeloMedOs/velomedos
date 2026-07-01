import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Body = z.object({
  action: z.enum(["submit","cancel","close"]),
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/batches/bulk")({
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
          const { data: b } = await db.from("claim_batch").select("*").eq("id", id).maybeSingle();
          if (!b || b.tenant_id !== auth.ctx.tenantId) throw new Error("not_found");
          if (body.data.action === "cancel") {
            if (b.status !== "open") throw new Error(`cannot_cancel_${b.status}`);
            await db.from("claim").update({ batch_id: null }).eq("batch_id", id);
            await db.from("claim_batch").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", id);
          } else if (body.data.action === "close") {
            if (b.status !== "submitted") throw new Error(`cannot_close_${b.status}`);
            await db.from("claim_batch").update({ status: "closed" }).eq("id", id);
          } else {
            if (b.status !== "open") throw new Error(`cannot_submit_${b.status}`);
            const { data: claims } = await db.from("claim").select("id, readiness_status, snapshot_locked_at").eq("batch_id", id);
            const bad = (claims ?? []).some((c: any) => c.readiness_status !== "ready" || !c.snapshot_locked_at);
            if (bad || (claims ?? []).length === 0) throw new Error("batch_not_ready");
            const now = new Date().toISOString();
            const ids = (claims ?? []).map((c: any) => c.id);
            await db.from("claim").update({ status: "submitted", submitted_at: now }).in("id", ids);
            await db.from("claim_batch").update({ status: "submitted", submitted_at: now }).eq("id", id);
          }
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : "error" });
        }
      }
      return jsonData({ results });
    },
  } },
});