/**
 * Phase 3 — shared CRUD helpers for master-data routes.
 *
 * Every master is tenant-scoped, reads require `requireTenant`, writes require
 * `tenant_admin` (per role-matrix). Each helper returns route handlers that
 * already include audit + standard envelope.
 */
import type { ZodTypeAny } from "zod";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  requireTenant,
  serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, assertMasterOwnership } from "../_helpers";

type Db = ReturnType<typeof serviceClient>;
/* eslint-disable @typescript-eslint/no-explicit-any */
const t = (db: Db, table: string) => (db as any).from(table);

export type ListCreateOpts<TCreate extends ZodTypeAny> = {
  table: string;
  audit: string;
  createSchema: TCreate;
  filterKeys?: string[];
  orderBy?: { column: string; ascending?: boolean };
  /** Optional callback to validate FK references in body against tenant. */
  validateRefs?: (body: any, tenantId: string) => Promise<Response | null>;
};

export function listCreateHandlers<TCreate extends ZodTypeAny>(opts: ListCreateOpts<TCreate>) {
  const parseCreate = parseBody((raw) => opts.createSchema.parse(raw));
  const order = opts.orderBy ?? { column: "created_at", ascending: false };
  return {
    OPTIONS: () => preflight(),
    GET: async ({ request }: { request: Request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      let q: any = t(serviceClient(), opts.table)
        .select("*", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order(order.column, { ascending: order.ascending ?? false })
        .range(offset, offset + limit - 1);
      for (const k of opts.filterKeys ?? []) {
        const v = url.searchParams.get(k);
        if (v !== null && v !== "") q = q.eq(k, v);
      }
      const { data, count, error } = await q;
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
    },
    POST: async ({ request }: { request: Request }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin"]);
      if (!auth.ok) return auth.res;
      const parsed = await parseCreate(request);
      if (!parsed.ok) return parsed.res;
      if (opts.validateRefs) {
        const err = await opts.validateRefs(parsed.data, auth.ctx.tenantId);
        if (err) return err;
      }
      const insertRow = {
        ...(parsed.data as Record<string, unknown>),
        tenant_id: auth.ctx.tenantId,
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      };
      const { data, error } = await t(serviceClient(), opts.table)
        .insert(insertRow).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `${opts.audit}.create`, opts.table, data.id);
      return jsonData({ data }, 201);
    },
  };
}

export type ItemOpts<TUpdate extends ZodTypeAny> = {
  table: string;
  audit: string;
  updateSchema: TUpdate;
  validateRefs?: (body: any, tenantId: string) => Promise<Response | null>;
};

export function itemHandlers<TUpdate extends ZodTypeAny>(opts: ItemOpts<TUpdate>) {
  const parseUpdate = parseBody((raw) => opts.updateSchema.parse(raw));
  return {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const { data, error } = await t(serviceClient(), opts.table)
        .select("*").eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (error) return envelope("database_error", "db_error", 500);
      if (!data) return envelope(`${opts.table} not found`, "not_found", 404);
      return jsonData({ data });
    },
    PATCH: async ({ request, params }: { request: Request; params: { id: string } }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin"]);
      if (!auth.ok) return auth.res;
      const parsed = await parseUpdate(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient();
      const { data: ex } = await t(db, opts.table)
        .select("id, tenant_id").eq("id", params.id).maybeSingle();
      if (!ex || ex.tenant_id !== auth.ctx.tenantId) {
        return envelope(`${opts.table} not found`, "not_found", 404);
      }
      if (opts.validateRefs) {
        const err = await opts.validateRefs(parsed.data, auth.ctx.tenantId);
        if (err) return err;
      }
      const { data, error } = await t(db, opts.table)
        .update({ ...(parsed.data as Record<string, unknown>), updated_by: auth.ctx.userId })
        .eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `${opts.audit}.update`, opts.table, params.id);
      return jsonData({ data });
    },
    DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin"]);
      if (!auth.ok) return auth.res;
      const db = serviceClient();
      const { data: ex } = await t(db, opts.table)
        .select("id, tenant_id").eq("id", params.id).maybeSingle();
      if (!ex || ex.tenant_id !== auth.ctx.tenantId) {
        return envelope(`${opts.table} not found`, "not_found", 404);
      }
      const { error } = await t(db, opts.table).delete().eq("id", params.id);
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `${opts.audit}.delete`, opts.table, params.id);
      return new Response(null, { status: 204 });
    },
  };
}

/**
 * Helper exposed for child-scoped routes that need to validate parent tenant
 * ownership and backfill the parent FK on insert (e.g. /services/$id/codes).
 */
export async function childListCreate<TCreate extends ZodTypeAny>(args: {
  request: Request;
  parentId: string;
  parentTable: string;
  parentFkColumn: string; // child column that holds parent's id
  childTable: string;
  audit: string;
  createSchema: TCreate;
  filterKeys?: string[];
  validateRefs?: (body: any, tenantId: string) => Promise<Response | null>;
}): Promise<Response> {
  if (args.request.method === "OPTIONS") return preflight();
  if (args.request.method === "GET") {
    const auth = await requireTenant(args.request);
    if (!auth.ok) return auth.res;
    const parentErr = await assertMasterOwnership(args.parentTable, args.parentId, auth.ctx.tenantId);
    if (parentErr) return parentErr;
    const url = new URL(args.request.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
    let q: any = t(serviceClient(), args.childTable)
      .select("*", { count: "exact" })
      .eq("tenant_id", auth.ctx.tenantId)
      .eq(args.parentFkColumn, args.parentId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    for (const k of args.filterKeys ?? []) {
      const v = url.searchParams.get(k);
      if (v !== null && v !== "") q = q.eq(k, v);
    }
    const { data, count, error } = await q;
    if (error) return envelope("database_error", "db_error", 500);
    return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
  }
  if (args.request.method === "POST") {
    const auth = await requireClinicalRole(args.request, ["tenant_admin"]);
    if (!auth.ok) return auth.res;
    const parentErr = await assertMasterOwnership(args.parentTable, args.parentId, auth.ctx.tenantId);
    if (parentErr) return parentErr;
    const parseCreate = parseBody((raw) => args.createSchema.parse(raw));
    const parsed = await parseCreate(args.request);
    if (!parsed.ok) return parsed.res;
    if (args.validateRefs) {
      const err = await args.validateRefs(parsed.data, auth.ctx.tenantId);
      if (err) return err;
    }
    const insertRow = {
      ...(parsed.data as Record<string, unknown>),
      [args.parentFkColumn]: args.parentId,
      tenant_id: auth.ctx.tenantId,
      created_by: auth.ctx.userId,
      updated_by: auth.ctx.userId,
    };
    const { data, error } = await t(serviceClient(), args.childTable)
      .insert(insertRow).select("*").single();
    if (error) return envelope("database_error", "db_error", 400);
    await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, `${args.audit}.create`, args.childTable, data.id);
    return jsonData({ data }, 201);
  }
  return envelope("Method not allowed", "method_not_allowed", 405);
}