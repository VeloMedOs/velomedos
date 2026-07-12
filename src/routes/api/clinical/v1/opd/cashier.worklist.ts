import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * HCA-0948 · Cashier worklist — caller-scoped view rows.
 * Reads `v_cashier_worklist` filtered by tenant. Non-admin cashier callers
 * see only their own encounters (cashier_assignment.user_id = ctx.userId).
 */
export async function handleGET(args: {
  query: { limit?: number; offset?: number };
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { ctx } = args;
  const limit = Math.min(Math.max(Number(args.query.limit ?? 50), 1), 200);
  const offset = Math.max(Number(args.query.offset ?? 0), 0);

  const { data, error } = await db.from("v_cashier_worklist")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("outstanding_minor", { ascending: false })
    .limit(limit + offset);
  if (error) return envelope("database_error", "db_error", 500);
  const rows = ((data as any[]) ?? []).slice(offset, offset + limit);
  return jsonData({ ok: true, data: { rows, total: (data as any[])?.length ?? 0 }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/cashier/worklist")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Billing — OP/ER", { capId: "opd.cashier.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      return handleGET({
        query: {
          limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
          offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
        },
        ctx: auth.ctx,
      });
    },
  } },
});