import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import { ALL_BATCH_STATUSES, type BatchStatus } from "@/lib/rcm/batch-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CreateBatch = z.object({
  payer_id: z.string().uuid(),
  integration_type: z.enum(["moh","gosi","cchi","direct","self_pay"]),
  claim_ids: z.array(z.string().uuid()).default([]),
  notes: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/batches")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status") ?? "";
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const db = serviceClient() as any;
      let sel = db.from("claim_batch").select("*").eq("tenant_id", auth.ctx.tenantId)
        .order("updated_at", { ascending: false }).limit(limit);
      if (status && ALL_BATCH_STATUSES.includes(status as BatchStatus)) sel = sel.eq("status", status);
      const { data, error } = await sel;
      if (error) return envelope("database_error", "db_error", 500);
      const { data: allStatus } = await db.from("claim_batch").select("status").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = { open: 0, submitting: 0, submitted: 0, closed: 0, cancelled: 0 };
      for (const r of (allStatus ?? []) as Array<{ status: string }>) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return jsonData({ data: data ?? [], counts, pagination: { total: (data ?? []).length, limit, offset: 0 } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const body = await parseBody((raw) => CreateBatch.parse(raw))(request);
      if (!body.ok) return body.res;
      const db = serviceClient() as any;
      const batchNo = `BATCH-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const ins = await db.from("claim_batch").insert({
        tenant_id: auth.ctx.tenantId,
        batch_no: batchNo,
        payer_id: body.data.payer_id,
        integration_type: body.data.integration_type,
        status: "open",
        notes: body.data.notes ?? null,
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      }).select("*").single();
      if (ins.error) return envelope("database_error", "db_error", 500);
      const errors: Array<{ id: string; error: string }> = [];
      let attached = 0;
      for (const cid of body.data.claim_ids) {
        const { data: c } = await db.from("claim").select("id, tenant_id, batch_id").eq("id", cid).maybeSingle();
        if (!c || c.tenant_id !== auth.ctx.tenantId) { errors.push({ id: cid, error: "not_found" }); continue; }
        if (c.batch_id) { errors.push({ id: cid, error: "already_batched" }); continue; }
        const upd = await db.from("claim").update({ batch_id: ins.data.id, readiness_status: "ready", snapshot_locked_at: new Date().toISOString() }).eq("id", cid);
        if (upd.error) { errors.push({ id: cid, error: "database_error" }); continue; }
        attached += 1;
      }
      if (attached > 0) {
        const { data: sum } = await db.from("claim").select("total_net_minor").eq("batch_id", ins.data.id);
        const total = (sum ?? []).reduce((s: number, r: any) => s + (r.total_net_minor ?? 0), 0);
        await db.from("claim_batch").update({ claim_count: attached, total_amount_minor: total }).eq("id", ins.data.id);
      }
      return jsonData({ data: ins.data, attached, errors }, 201);
    },
  } },
});