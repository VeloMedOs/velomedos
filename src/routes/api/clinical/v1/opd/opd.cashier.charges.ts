import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * HCA-0793/0209/1062 · Cashier line items for one encounter.
 * Joins `charge_item` → latest `authorization_item` → parent `authorization_request`
 * → `service_master.billing_type` (KK1 — billing_type lives on the catalog, not
 * on charge_item). Returns approved_amount_minor from authorization_item.
 *
 * `auth_status` == authorization_item.decision (per-item)
 * `request_status` == authorization_request.status (for "Raise pre-auth" gating — KK3)
 */
export async function handleGET(args: {
  query: { encounter_id: string };
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { ctx, query } = args;

  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id, coverage_id")
    .eq("id", query.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  const { data: charges, error } = await db.from("charge_item")
    .select("id, tenant_id, encounter_id, service_id, drug_id, description, quantity, unit_price_minor, patient_share_minor, payer_share_minor, net_minor, pricing_mode, status, order_item_table, order_item_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("encounter_id", query.encounter_id)
    .neq("status", "cancelled");
  if (error) return envelope("database_error", "db_error", 500);

  const rows: any[] = [];
  for (const c of (charges as any[]) ?? []) {
    const { data: aItems } = await db.from("authorization_item")
      .select("id, decision, benefit_amount_minor, authorization_request_id")
      .eq("charge_item_id", c.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    const aItem = (aItems as any[])?.[0] ?? null;
    let requestStatus: string | null = null;
    if (aItem?.authorization_request_id) {
      const { data: aReq } = await db.from("authorization_request")
        .select("status")
        .eq("id", aItem.authorization_request_id).maybeSingle();
      requestStatus = (aReq as any)?.status ?? null;
    }
    let billingType: string | null = null;
    if (c.service_id) {
      const { data: sm } = await db.from("service_master")
        .select("billing_type").eq("id", c.service_id).maybeSingle();
      billingType = (sm as any)?.billing_type ?? null;
    }
    rows.push({
      ...c,
      auth_status: aItem?.decision ?? null,
      request_status: requestStatus,
      approved_amount_minor: aItem?.benefit_amount_minor ?? 0,
      copay_minor: Math.max(Number(c.patient_share_minor ?? 0), 0),
      billing_type: billingType,
    });
  }
  return jsonData({ ok: true, data: { rows, encounter: enc }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/cashier/charges")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Billing — OP/ER", { capId: "opd.cashier.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const encounter_id = url.searchParams.get("encounter_id");
      if (!encounter_id) return envelope("encounter_id required", "bad_body", 400);
      return handleGET({ query: { encounter_id }, ctx: auth.ctx });
    },
  } },
});