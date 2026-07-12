import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handleGET(args: { query: { encounter_id: string }; ctx: OpdCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { ctx, query } = args;
  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id").eq("id", query.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  const { data: gate } = await db.rpc("wallet_gate_open", {
    _beneficiary_id: enc.beneficiary_id, _tenant_id: ctx.tenantId,
  });
  const { data: w } = await db.from("patient_wallet")
    .select("balance_minor").eq("tenant_id", ctx.tenantId).eq("beneficiary_id", enc.beneficiary_id).maybeSingle();
  const balance = Number((w as any)?.balance_minor ?? 0);

  return jsonData({
    ok: true,
    data: { open: gate !== false, balance_minor: balance, wallet_present: !!w },
    request_id: crypto.randomUUID(),
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/orders/wallet-gate")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.orders.wallet_gate" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const encounter_id = url.searchParams.get("encounter_id");
      if (!encounter_id) return envelope("encounter_id required", "bad_body", 400);
      return handleGET({ query: { encounter_id }, ctx: auth.ctx });
    },
  } },
});