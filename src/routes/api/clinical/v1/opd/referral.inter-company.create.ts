/**
 * Step 5 · Turn 2 — Inter-company referral write (HCA-0979).
 * Cluster-scoped write of a target_kind='entity' referral_target in the
 * sending tenant's context. Sibling tenant reads via Turn 1 read route.
 * Idempotency: source_key='inter_co:{referral_id}:{target_entity_id}'.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";
import { sendInterCompanyReferralNotification } from "@/lib/interface/sms-gateway";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type InterCoCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export const InterCoBody = z.object({
  referral_id: z.string().uuid(),
  target_entity_id: z.string().uuid(),
  target_specialty: z.string().nullish(),
  target_provider_id: z.string().uuid().nullish(),
});
export type InterCoBodyT = z.infer<typeof InterCoBody>;

export async function handlePOST(args: {
  body: InterCoBodyT;
  ctx: InterCoCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();

  const { data: me } = await db.from("corporate_accounts").select("id, cluster_id").eq("id", args.ctx.tenantId).maybeSingle();
  const { data: sib } = await db.from("corporate_accounts").select("id, cluster_id").eq("id", args.body.target_entity_id).maybeSingle();
  if (!me || !sib) return envelope("Entity not found", "entity_not_found", 404);

  const myCluster = (me as any).cluster_id as string | null;
  const sibCluster = (sib as any).cluster_id as string | null;
  if (!myCluster || !sibCluster) return envelope("Tenant is not assigned to a health_cluster", "cluster_missing", 403);
  if (myCluster !== sibCluster) return envelope("Sibling entity is in a different health_cluster", "cluster_mismatch", 403);

  const { data: parent } = await db.from("referral")
    .select("id, tenant_id, referral_class")
    .eq("id", args.body.referral_id)
    .eq("tenant_id", args.ctx.tenantId)
    .maybeSingle();
  if (!parent) return envelope("referral not found", "referral_not_found", 404);

  const sourceKey = `inter_co:${args.body.referral_id}:${args.body.target_entity_id}`;
  const { data: existing } = await db.from("referral_target")
    .select("id")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("source_key", sourceKey)
    .limit(1);
  if (Array.isArray(existing) && existing.length > 0) {
    return jsonData({
      ok: true,
      data: {
        target_id: (existing[0] as any).id,
        sibling_tenant_id: args.body.target_entity_id,
        idempotent: true,
      },
    });
  }

  const { data: tgtIns, error: tgtErr } = await db.from("referral_target").insert({
    tenant_id: args.ctx.tenantId,
    referral_id: args.body.referral_id,
    target_kind: "entity",
    target_entity_id: args.body.target_entity_id,
    target_specialty: args.body.target_specialty ?? null,
    target_provider_id: args.body.target_provider_id ?? null,
    status: "submitted",
    source_key: sourceKey,
  }).select("id").single();
  if (tgtErr || !tgtIns) return envelope(tgtErr?.message ?? "insert failed", "db_error", 500);

  // Convention #27 — always route through the SMS-gateway stub (debt #42).
  try {
    await sendInterCompanyReferralNotification({
      tenant_id: args.ctx.tenantId,
      sibling_tenant_id: args.body.target_entity_id,
      referral_id: args.body.referral_id,
      target_id: (tgtIns as any).id,
    }, db);
  } catch { /* best-effort */ }

  return jsonData({
    ok: true,
    data: {
      target_id: (tgtIns as any).id,
      sibling_tenant_id: args.body.target_entity_id,
    },
  }, 201);
}

export const Route = createFileRoute("/api/clinical/v1/opd/referral/inter-company/create")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.inter_company.create" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => InterCoBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      return handlePOST({ body: parsed.data, ctx: auth.ctx });
    },
  } },
});