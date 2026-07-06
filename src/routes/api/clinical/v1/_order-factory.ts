/**
 * Phase 4 — shared factory for header+items order routes.
 *
 * Each modality's POST creates the header, then for each item:
 *   1) inserts the item row
 *   2) runs resolvePrice() against the master ref
 *   3) inserts a charge_item snapshot referencing the item row
 *
 * Handlers return { order, items, charges }. Cancel: PATCH item to cancelled
 * also flips linked charge_item to cancelled (handled in the per-item route).
 */
import type { ZodTypeAny } from "zod";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  requireTenant,
  serviceClient,
  type ClinicalRole,
} from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, assertMasterOwnership } from "./_helpers";
import { resolvePrice } from "@/lib/mds/pricing";
import { evaluateTriggers, ensureAuthorizationForOrder, type TriggerInputItem } from "@/lib/rcm/auth-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
const t = (db: any, table: string) => db.from(table);

/**
 * Optional per-modality hooks. Only prescriptions wire these today (PBM
 * validation). A hook returning a Response short-circuits the factory and
 * returns that response to the caller.
 */
export type FactoryHookCtx = {
  db: any;
  tenantId: string;
  userId: string;
  encounterId: string;
};
export type FactoryItemHooks = {
  preCreate?: (ctx: FactoryHookCtx, item: any) => Promise<Response | void>;
  prePatch?: (ctx: FactoryHookCtx & { itemId: string }, patch: any) => Promise<Response | void>;
};

export type ModalityConfig<TCreate extends ZodTypeAny> = {
  headerTable: string;
  itemTable: string;
  audit: string;
  createSchema: TCreate;
  postRoles: ClinicalRole[];
  // map a validated item into a DB row (without tenant/order/created_by — added by factory)
  itemToRow: (item: any) => Record<string, unknown>;
  // resolve master reference for pricing snapshot
  resolveRef: (item: any) => { source: "service" | "drug"; serviceId?: string | null; drugId?: string | null; quantity: number; bodySite?: string | null };
  hooks?: FactoryItemHooks;
};

export function orderRouteHandlers<TCreate extends ZodTypeAny>(cfg: ModalityConfig<TCreate>) {
  const parseCreate = parseBody((raw) => cfg.createSchema.parse(raw));
  return {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const db = serviceClient();
      const { data: headers, error } = await t(db, cfg.headerTable).select("*")
        .eq("tenant_id", auth.ctx.tenantId).eq("encounter_id", params.id)
        .order("ordered_at", { ascending: false });
      if (error) return envelope("database_error", "db_error", 500);
      const ids = (headers ?? []).map((h: any) => h.id);
      const items = ids.length
        ? (await t(db, cfg.itemTable).select("*").in("order_id", ids)).data ?? []
        : [];
      return jsonData({ data: { orders: headers ?? [], items } });
    },
    POST: async ({ request, params }: { request: Request; params: { id: string } }) => {
      const auth = await requireClinicalRole(request, cfg.postRoles);
      if (!auth.ok) return auth.res;
      const parsed = await parseCreate(request);
      if (!parsed.ok) return parsed.res;
      const body = parsed.data as any;
      const db = serviceClient();
      // assert encounter ownership
      const { data: enc } = await t(db, "encounter").select("id, tenant_id")
        .eq("id", params.id).maybeSingle();
      if (!enc || enc.tenant_id !== auth.ctx.tenantId) {
        return envelope("encounter not found", "not_found", 404);
      }
      // validate master refs
      for (const it of body.items as any[]) {
        const ref = cfg.resolveRef(it);
        if (ref.source === "service" && ref.serviceId) {
          const err = await assertMasterOwnership("service_master", ref.serviceId, auth.ctx.tenantId);
          if (err) return err;
        }
        if (ref.source === "drug" && ref.drugId) {
          const err = await assertMasterOwnership("drug_master", ref.drugId, auth.ctx.tenantId);
          if (err) return err;
        }
      }
      // insert header
      const headerRow = {
        tenant_id: auth.ctx.tenantId,
        encounter_id: params.id,
        priority: body.priority ?? null,
        notes: body.notes ?? null,
        ordered_by: body.ordered_by ?? auth.ctx.userId,
        preauth_required: body.preauth_required ?? false,
        preauth_ref: body.preauth_ref ?? null,
        preauth_status: body.preauth_status ?? null,
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      };
      const { data: header, error: hErr } = await t(db, cfg.headerTable)
        .insert(headerRow).select("*").single();
      if (hErr) return envelope(hErr.message, "db_error", 400);

      const itemsOut: any[] = [];
      const chargesOut: any[] = [];
      for (const it of body.items as any[]) {
        if (cfg.hooks?.preCreate) {
          const hookRes = await cfg.hooks.preCreate(
            { db, tenantId: auth.ctx.tenantId, userId: auth.ctx.userId, encounterId: params.id },
            it,
          );
          if (hookRes) return hookRes;
        }
        const itemRow = {
          ...cfg.itemToRow(it),
          tenant_id: auth.ctx.tenantId,
          order_id: header.id,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        };
        const { data: itemIns, error: iErr } = await t(db, cfg.itemTable)
          .insert(itemRow).select("*").single();
        if (iErr) return envelope(iErr.message, "db_error", 400);
        itemsOut.push(itemIns);

        const ref = cfg.resolveRef(it);
        try {
          const charge = await resolvePrice({
            tenantId: auth.ctx.tenantId,
            encounterId: params.id,
            source: ref.source,
            serviceId: ref.serviceId ?? null,
            drugId: ref.drugId ?? null,
            quantity: ref.quantity,
            bodySite: ref.bodySite ?? null,
            orderedBy: auth.ctx.userId,
          });
          const chargeRow = {
            ...charge,
            order_item_table: cfg.itemTable,
            order_item_id: itemIns.id,
            status: "ordered" as const,
          };
          const { data: chIns, error: cErr } = await t(db, "charge_item")
            .insert(chargeRow).select("*").single();
          if (cErr) return envelope(cErr.message, "charge_insert_failed", 400);
          chargesOut.push(chIns);
        } catch (e) {
          return envelope((e as Error).message, "pricing_failed", 400);
        }
      }

      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `${cfg.audit}.create`,
        cfg.headerTable, header.id, { item_count: itemsOut.length });

      // R2 — evaluate authorization triggers and, if hit, create the
      // authorization_request additively (best-effort; order write already
      // succeeded, so we swallow trigger errors and log them).
      let authOut: { authorization_request_id: string; requires_auth: boolean; reasons: string[] } | null = null;
      try {
        const trigItems: TriggerInputItem[] = (body.items as any[]).map((it) => {
          const ref = cfg.resolveRef(it);
          return {
            source: ref.source,
            service_id: ref.serviceId ?? null,
            drug_id: ref.drugId ?? null,
            quantity: ref.quantity,
          };
        });
        const trg = await evaluateTriggers({
          tenantId: auth.ctx.tenantId,
          encounterId: params.id,
          items: trigItems,
        });
        if (trg.requires_auth) {
          const created = await ensureAuthorizationForOrder({
            tenantId: auth.ctx.tenantId,
            encounterId: params.id,
            userId: auth.ctx.userId,
            hits: trg.hits,
            reasons: trg.reasons,
            items: trigItems,
            chargeIds: chargesOut.map((c: any) => c?.id ?? null),
          });
          if (created) {
            authOut = {
              authorization_request_id: created.id,
              requires_auth: true,
              reasons: trg.reasons,
            };
          }
        } else {
          authOut = { authorization_request_id: "", requires_auth: false, reasons: [] };
        }
      } catch (e) {
        // Non-blocking — order write already committed.
        console.warn("[auth-trigger] evaluation failed:", (e as Error).message);
      }

      return jsonData({
        data: {
          order: header,
          items: itemsOut,
          charges: chargesOut,
          ...(authOut ? { authorization: authOut } : {}),
        },
      }, 201);
    },
  };
}

/**
 * Generic per-item PATCH/DELETE handlers. DELETE = cancel: sets item status to
 * 'cancelled' and flips the linked charge_item to cancelled.
 */
export function orderItemHandlers<TUpdate extends ZodTypeAny>(opts: {
  table: string;
  audit: string;
  updateSchema: TUpdate;
  patchRoles: ClinicalRole[];
  hooks?: FactoryItemHooks;
}) {
  const parseUpdate = parseBody((raw) => opts.updateSchema.parse(raw));
  return {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const { data } = await (serviceClient() as any).from(opts.table).select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (!data) return envelope(`${opts.table} not found`, "not_found", 404);
      return jsonData({ data });
    },
    PATCH: async ({ request, params }: { request: Request; params: { id: string } }) => {
      const auth = await requireClinicalRole(request, opts.patchRoles);
      if (!auth.ok) return auth.res;
      const parsed = await parseUpdate(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: ex } = await db.from(opts.table).select("id, tenant_id").eq("id", params.id).maybeSingle();
      if (!ex || ex.tenant_id !== auth.ctx.tenantId) {
        return envelope(`${opts.table} not found`, "not_found", 404);
      }
      if (opts.hooks?.prePatch) {
        const hookRes = await opts.hooks.prePatch(
          { db, tenantId: auth.ctx.tenantId, userId: auth.ctx.userId, encounterId: "", itemId: params.id },
          parsed.data as any,
        );
        if (hookRes) return hookRes;
      }
      // Turn-4 · pre-check the billed gate for advance-to-perform transitions.
      // The SQL guard trigger still enforces on commit; this returns a friendly
      // 403 GATE_BILLED so clients can render the tooltip without a DB roundtrip.
      const advancing =
        (parsed.data as any)?.status === "in_progress" ||
        (parsed.data as any)?.status === "completed" ||
        (parsed.data as any)?.dispense_status === "dispensed";
      if (advancing) {
        const { data: billed } = await db.rpc("charge_is_billed", {
          _tbl: opts.table, _id: params.id,
        });
        if (billed === false) {
          return envelope("billed gate: order not billable", "GATE_BILLED", 403);
        }
      }
      const { data, error } = await db.from(opts.table)
        .update({ ...(parsed.data as Record<string, unknown>), updated_by: auth.ctx.userId })
        .eq("id", params.id).select("*").single();
      if (error) {
        // Surface the SQL trigger's billed_gate signal as a 403 too.
        const msg = (error as any)?.message ?? "";
        if (typeof msg === "string" && msg.includes("billed_gate")) {
          return envelope("billed gate: order not billable", "GATE_BILLED", 403);
        }
        return envelope("database_error", "db_error", 400);
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `${opts.audit}.update`, opts.table, params.id);
      return jsonData({ data });
    },
    DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
      const auth = await requireClinicalRole(request, opts.patchRoles);
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: ex } = await db.from(opts.table).select("id, tenant_id").eq("id", params.id).maybeSingle();
      if (!ex || ex.tenant_id !== auth.ctx.tenantId) {
        return envelope(`${opts.table} not found`, "not_found", 404);
      }
      await db.from(opts.table).update({ status: "cancelled", updated_by: auth.ctx.userId }).eq("id", params.id);
      await db.from("charge_item").update({ status: "cancelled" })
        .eq("order_item_table", opts.table).eq("order_item_id", params.id);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `${opts.audit}.cancel`, opts.table, params.id);
      return new Response(null, { status: 204 });
    },
  };
}