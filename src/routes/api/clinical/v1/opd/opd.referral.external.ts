/**
 * Step 5 · Turn 1 — External referral read (read-only skeleton).
 * Debt #22 (`referral_network`) blocks true external routing; this endpoint
 * lists outbound external referrals plus a banner flagging that networked
 * dispatch is not yet enabled.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ExtRefCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export async function handleGET(args: { ctx: ExtRefCtx; db?: any; limit?: number }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const limit = Math.min(args.limit ?? 100, 500);

  const { data: referrals, error } = await db.from("referral")
    .select("id, referral_no, source_encounter_id, source_specialty, referral_class, status, reason, created_at")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("referral_class", "external")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return envelope(error.message ?? "database_error", "db_error", 500);

  return jsonData({
    ok: true,
    data: {
      referrals: (referrals ?? []) as any[],
      network_enabled: false,
      debt_banner: "External referral network (#22 `referral_network`) not yet enabled — outbound dispatch stubbed.",
    },
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/referral/external")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.external.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") ?? "100", 10) || 100;
      return handleGET({ ctx: auth.ctx, limit });
    },
  } },
});