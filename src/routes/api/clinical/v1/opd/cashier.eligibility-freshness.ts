import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handleGET(args: {
  query: { encounter_id: string }; ctx: OpdCtx; db?: any; now?: Date;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { ctx, query } = args;
  const now = args.now ?? new Date();

  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id, coverage_id")
    .eq("id", query.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  const { data: ve } = await db.from("visit_eligibility")
    .select("id, status, checked_at")
    .eq("tenant_id", ctx.tenantId).eq("encounter_id", enc.id)
    .order("checked_at", { ascending: false }).limit(1);
  const last = (ve as any[])?.[0] ?? null;
  const checkedAt = last?.checked_at ? new Date(last.checked_at) : null;
  const today = now.toISOString().slice(0, 10);
  const stale = !checkedAt || checkedAt.toISOString().slice(0, 10) !== today;

  return jsonData({
    ok: true,
    data: { stale, must_recheck: stale, last_check_at: checkedAt?.toISOString() ?? null, status: last?.status ?? null },
    request_id: crypto.randomUUID(),
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/cashier/eligibility-freshness")({
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