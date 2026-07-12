/**
 * Step 5 · Turn 1 — Inter-Company referral read (HCA-0979, file 20 §only-new-data).
 * Reads referrals with `referral_class='inter_company'` for tenants sharing
 * a `health_cluster` via `corporate_accounts.cluster_id`. Read-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type InterCoCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export async function handleGET(args: { ctx: InterCoCtx; db?: any; limit?: number }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const limit = Math.min(args.limit ?? 100, 500);

  // Resolve this tenant's cluster (if any) — cluster is a hint only.
  const { data: acct } = await db.from("corporate_accounts")
    .select("id, cluster_id, name")
    .eq("id", args.ctx.tenantId)
    .maybeSingle();
  const clusterId: string | null = acct?.cluster_id ?? null;

  let siblingIds: string[] = [];
  if (clusterId) {
    const { data: siblings } = await db.from("corporate_accounts")
      .select("id, name, cluster_id")
      .eq("cluster_id", clusterId);
    siblingIds = ((siblings ?? []) as any[]).map((s) => s.id).filter((id) => id !== args.ctx.tenantId);
  }

  const { data: referrals, error } = await db.from("referral")
    .select("id, referral_no, source_encounter_id, source_specialty, referral_class, status, reason, created_at")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("referral_class", "inter_company")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return envelope(error.message ?? "database_error", "db_error", 500);

  return jsonData({
    ok: true,
    data: {
      cluster_id: clusterId,
      sibling_tenant_ids: siblingIds,
      referrals: (referrals ?? []) as any[],
    },
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/referral/inter-company")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.inter_company.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") ?? "100", 10) || 100;
      return handleGET({ ctx: auth.ctx, limit });
    },
  } },
});