/**
 * Step 5 · Turn 1 — Rule Engine admin facade (Rules A–E, scope='referral').
 * CRUD wrapper over existing tables:
 *   - approval_rule, need_approval_rule, not_covered_rule, pricing_rule
 * Only rows scoped to this tenant (or NULL tenant, read-only) surface.
 * Writes require `rules.admin` capability (tenant_admin).
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

/* eslint-disable @typescript-eslint/no-explicit-any */

const RULE_TABLES = ["approval_rule", "need_approval_rule", "not_covered_rule", "pricing_rule"] as const;
type RuleTable = (typeof RULE_TABLES)[number];

export type RulesAdminCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

function isRuleTable(t: string | null): t is RuleTable {
  return !!t && (RULE_TABLES as readonly string[]).includes(t);
}

export async function handleGET(args: { table: RuleTable; ctx: RulesAdminCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { data, error } = await db.from(args.table)
    .select("*")
    .or(`tenant_id.eq.${args.ctx.tenantId},tenant_id.is.null`)
    .order("priority", { ascending: true });
  if (error) return envelope(error.message ?? "database_error", "db_error", 500);
  return jsonData({ ok: true, table: args.table, data: (data ?? []) as any[] });
}

export async function handlePOST(args: { table: RuleTable; body: any; ctx: RulesAdminCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const row = { ...args.body, tenant_id: args.ctx.tenantId };
  const { data, error } = await db.from(args.table).insert(row).select().maybeSingle();
  if (error) return envelope(error.message ?? "insert_failed", "db_error", 500);
  return jsonData({ ok: true, table: args.table, data });
}

export async function handlePATCH(args: { table: RuleTable; id: string; body: any; ctx: RulesAdminCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const patch = { ...args.body };
  delete patch.tenant_id;
  const { data, error } = await db.from(args.table)
    .update(patch)
    .eq("id", args.id)
    .eq("tenant_id", args.ctx.tenantId)
    .select()
    .maybeSingle();
  if (error) return envelope(error.message ?? "update_failed", "db_error", 500);
  if (!data) return envelope("rule not found or not owned", "not_found", 404);
  return jsonData({ ok: true, table: args.table, data });
}

export async function handleDELETE(args: { table: RuleTable; id: string; ctx: RulesAdminCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { error } = await db.from(args.table).delete().eq("id", args.id).eq("tenant_id", args.ctx.tenantId);
  if (error) return envelope(error.message ?? "delete_failed", "db_error", 500);
  return jsonData({ ok: true, table: args.table });
}

export const Route = createFileRoute("/api/clinical/v1/rcm/rules/admin")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "rules.admin" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const table = url.searchParams.get("table");
      if (!isRuleTable(table)) return envelope("table must be one of approval_rule|need_approval_rule|not_covered_rule|pricing_rule", "bad_query", 400);
      return handleGET({ table, ctx: auth.ctx });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "rules.admin" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const table = url.searchParams.get("table");
      if (!isRuleTable(table)) return envelope("table required", "bad_query", 400);
      const body = await request.json().catch(() => null);
      if (!body) return envelope("Invalid JSON body", "bad_json", 400);
      return handlePOST({ table, body, ctx: auth.ctx });
    },
    PATCH: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "rules.admin" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const table = url.searchParams.get("table");
      const id = url.searchParams.get("id");
      if (!isRuleTable(table) || !id) return envelope("table & id required", "bad_query", 400);
      const body = await request.json().catch(() => null);
      if (!body) return envelope("Invalid JSON body", "bad_json", 400);
      return handlePATCH({ table, id, body, ctx: auth.ctx });
    },
    DELETE: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "rules.admin" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const table = url.searchParams.get("table");
      const id = url.searchParams.get("id");
      if (!isRuleTable(table) || !id) return envelope("table & id required", "bad_query", 400);
      return handleDELETE({ table, id, ctx: auth.ctx });
    },
  } },
});