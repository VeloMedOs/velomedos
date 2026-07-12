/**
 * Step 5 · Turn 1 — Cross-Encounter Referral read (file 08 §C1).
 * Reads referrals with `referral_class='cross_encounter'` plus a lightweight
 * "landing" hint per target_kind (er | ip | or | endo | lnd). Read-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CrossEncCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export async function handleGET(args: { ctx: CrossEncCtx; db?: any; limit?: number }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const limit = Math.min(args.limit ?? 100, 500);

  const { data: referrals, error } = await db.from("referral")
    .select("id, referral_no, source_encounter_id, source_specialty, referral_class, status, reason, created_at")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("referral_class", "cross_encounter")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return envelope(error.message ?? "database_error", "db_error", 500);

  const list = (referrals ?? []) as any[];
  const ids = list.map((r) => r.id);

  const targetsById: Record<string, any[]> = {};
  if (ids.length) {
    const { data: targets } = await db.from("referral_target")
      .select("id, referral_id, target_kind, target_specialty, target_service_id, status, booked_appointment_id")
      .in("referral_id", ids);
    for (const t of (targets ?? []) as any[]) {
      (targetsById[t.referral_id] ||= []).push(t);
    }
  }

  return jsonData({ ok: true, data: list.map((r) => ({ ...r, targets: targetsById[r.id] ?? [] })) });
}

export const Route = createFileRoute("/api/clinical/v1/opd/referral/cross-encounter")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "referral.cross_encounter.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") ?? "100", 10) || 100;
      return handleGET({ ctx: auth.ctx, limit });
    },
  } },
});