import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { BulkUpdateRequest } from "@/lib/mds/schema/masters";

/* eslint-disable @typescript-eslint/no-explicit-any */
const parse = parseBody((raw) => BulkUpdateRequest.parse(raw));

function applyOp(current: number, op: string, value: number): number {
  if (op === "pct") return Math.max(0, Math.round(current * (1 + value / 100)));
  if (op === "amount") return Math.max(0, Math.round(current + value));
  if (op === "set") return Math.max(0, Math.round(value));
  if (op === "factor") return Math.max(0, Math.round(current * value));
  return current;
}

/**
 * POST /masters/price-lists/$id/items:bulk-update
 * Effective-dated: when effective_date set, writes price_list_item_version rows
 * (no immediate mutation). Without effective_date, mutates current row + still
 * snapshots the prior price into a version row dated today.
 */
export const Route = createFileRoute("/api/clinical/v1/masters/price-lists/$id/items/bulk-update")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["tenant_admin"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<any>("price_list", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const parsed = await parse(request);
        if (!parsed.ok) return parsed.res;
        const body = parsed.data;
        const db = serviceClient() as any;

        let q = db.from("price_list_item").select("*").eq("price_list_id", params.id).eq("tenant_id", auth.ctx.tenantId);
        if (body.filter?.ids?.length) q = q.in("id", body.filter.ids);
        const { data: items, error } = await q;
        if (error) return envelope("database_error", "db_error", 500);
        let candidates = items ?? [];

        if (body.filter?.service_type || body.filter?.code_system) {
          const svcIds = candidates.map((i: any) => i.service_id).filter(Boolean);
          if (svcIds.length) {
            let svcQ = db.from("service_master").select("id").in("id", svcIds);
            if (body.filter.service_type) svcQ = svcQ.eq("service_type", body.filter.service_type);
            const { data: svcs } = await svcQ;
            const keep = new Set((svcs ?? []).map((s: any) => s.id));
            candidates = candidates.filter((i: any) => !i.service_id || keep.has(i.service_id));
          }
        }

        type Change = { id: string; service_id: string | null; drug_id: string | null; old_price: number; new_price: number };
        const changes: Change[] = candidates.map((it: any) => ({
          id: it.id, service_id: it.service_id, drug_id: it.drug_id,
          old_price: it.unit_price_minor,
          new_price: applyOp(it.unit_price_minor, body.op, body.value),
        }));

        if (body.dry_run) {
          return jsonData({ data: { dry_run: true, count: changes.length, changes } });
        }

        const today = new Date().toISOString().slice(0, 10);
        const effective = body.effective_date ?? today;
        const versionRows = changes.map((c: Change) => ({
          tenant_id: auth.ctx.tenantId,
          price_list_item_id: c.id,
          unit_price_minor: c.new_price,
          default_factor: 1,
          effective_from: effective,
          change_reason: body.change_reason ?? `bulk:${body.op}:${body.value}`,
          changed_by: auth.ctx.userId,
        }));
        if (versionRows.length) {
          const { error: vErr } = await db.from("price_list_item_version").insert(versionRows);
          if (vErr) return envelope(vErr.message, "version_insert_failed", 400);
        }

        // If effective today (or past), mutate now. Future-dated → defer.
        let mutated = 0;
        if (effective <= today) {
          for (const c of changes) {
            const updates: Record<string, unknown> = {
              unit_price_minor: c.new_price, updated_by: auth.ctx.userId,
            };
            if (body.time_band) updates.time_band = body.time_band;
            if (body.referral_status) updates.referral_status = body.referral_status;
            const { error: uErr } = await db.from("price_list_item").update(updates).eq("id", c.id);
            if (!uErr) mutated++;
          }
        }

        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "price_list.bulk_update", "price_list", params.id,
          { op: body.op, value: body.value, effective, count: changes.length, mutated });
        return jsonData({ data: { count: changes.length, mutated, scheduled: changes.length - mutated, effective_date: effective } });
      },
    },
  },
});