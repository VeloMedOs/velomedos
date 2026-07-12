import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HCA-0250/0251 · Order Profile "Billed Status" column readout.
 * Reads `v_order_item_gate` for the encounter and returns rows grouped by
 * order type. Presentation only — the trigger is the enforcing gate.
 */
export async function handleGET(args: {
  params: { encounter_id: string };
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { params, ctx } = args;

  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id").eq("id", params.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  const { data, error } = await db.from("v_order_item_gate")
    .select("order_item_table, order_item_id, charge_item_id, encounter_id, pricing_mode, net_minor, gate_state, exception_id, reason_code")
    .eq("encounter_id", params.encounter_id);
  if (error) return envelope("database_error", "db_error", 500);

  const grouped: Record<string, any[]> = {};
  for (const row of (data as any[]) ?? []) {
    const key = String(row.order_item_table ?? "unknown");
    (grouped[key] ||= []).push({
      ...row,
      billed_label: row.gate_state === "billed" || row.gate_state === "released_by_exception" ? "Paid" : "Unpaid",
    });
  }
  return jsonData({ ok: true, data: { rows: data ?? [], grouped }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/orders/billed-status")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.orders.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const encounter_id = url.searchParams.get("encounter_id");
      if (!encounter_id) return envelope("encounter_id required", "bad_body", 400);
      return handleGET({ params: { encounter_id }, ctx: auth.ctx });
    },
  } },
});