/**
 * Step 4 · Turn 4 — Pending auto-generated nutrition referrals (HCA-0255).
 *
 * Filters `referral` rows where `source_key LIKE 'nutrition_screen:%'` and
 * status is still 'draft'/'submitted' (not yet acted on by the Referral
 * Cockpit in Step 5). Read-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handleGET(args: {
  query: { encounter_id: string | null };
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  let q = db.from("referral")
    .select("id, referral_no, source_encounter_id, beneficiary_id, status, reason, source_key, created_at")
    .eq("tenant_id", args.ctx.tenantId)
    .like("source_key", "nutrition_screen:%")
    .in("status", ["draft", "submitted"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (args.query.encounter_id) q = q.eq("source_encounter_id", args.query.encounter_id);
  const { data, error } = await q;
  if (error) return envelope(error.message ?? "database_error", "db_error", 500);
  return jsonData({ ok: true, data: { rows: data ?? [] }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/nutrition/referrals/pending")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.nutrition.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      return handleGET({ query: { encounter_id: url.searchParams.get("encounter_id") }, ctx: auth.ctx });
    },
  } },
});