import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Body = z.object({
  encounter_id: z.string().uuid(),
  charge_item_id: z.string().uuid(),
  reason: z.string().min(1).optional(),
});
export type RaisePreauthBody = z.infer<typeof Body>;

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handlePOST(args: { body: RaisePreauthBody; ctx: OpdCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { body, ctx } = args;

  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id, coverage_id")
    .eq("id", body.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  const { data: charge } = await db.from("charge_item")
    .select("id, tenant_id, service_id, drug_id, quantity, net_minor")
    .eq("id", body.charge_item_id).maybeSingle();
  if (!charge || charge.tenant_id !== ctx.tenantId) return envelope("charge not found", "not_found", 404);

  const { data: existingItems } = await db.from("authorization_item")
    .select("id, authorization_request_id")
    .eq("charge_item_id", body.charge_item_id)
    .order("updated_at", { ascending: false }).limit(1);
  const prevItem = (existingItems as any[])?.[0];
  if (prevItem?.authorization_request_id) {
    const { data: prevReq } = await db.from("authorization_request")
      .select("status").eq("id", prevItem.authorization_request_id).maybeSingle();
    const st = (prevReq as any)?.status;
    if (st && st !== "expired" && st !== "cancelled" && st !== "rejected" && st !== "closed") {
      return envelope("existing authorization request is still active", "preauth_active", 409, { request_status: st });
    }
  }

  const { data: req, error: rErr } = await db.from("authorization_request").insert({
    tenant_id: ctx.tenantId, encounter_id: enc.id, coverage_id: enc.coverage_id,
    status: "new", reason: body.reason ?? null,
    created_by: ctx.userId, updated_by: ctx.userId,
  }).select("*").single();
  if (rErr) return envelope(rErr.message, "db_error", 400);

  const { data: item, error: iErr } = await db.from("authorization_item").insert({
    tenant_id: ctx.tenantId, authorization_request_id: (req as any).id,
    service_id: charge.service_id, drug_id: charge.drug_id,
    charge_item_id: charge.id, quantity: charge.quantity, decision: "pending",
    created_by: ctx.userId, updated_by: ctx.userId,
  }).select("*").single();
  if (iErr) return envelope(iErr.message, "db_error", 400);

  return jsonData({ ok: true, data: { authorization_request: req, authorization_item: item }, request_id: crypto.randomUUID() }, 201);
}

export const Route = createFileRoute("/api/clinical/v1/opd/cashier/raise-preauth")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Billing — OP/ER", { capId: "opd.cashier.write" });
      if (!auth.ok) return auth.res;
      let body: RaisePreauthBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});