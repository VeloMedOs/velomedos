import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import { bucketOfRefund } from "@/lib/rcm/refund-sm";
import { validateRefundRequest } from "@/lib/rcm/validation";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Refund request worklist + creation. Method rules enforced in DB + validator. */
const Create = z.object({
  deposit_id: z.string().uuid(),
  amount_minor: z.number().int().positive(),
  refund_method: z.enum(["cash","bank_transfer","card_reversal"]),
  reason: z.string().min(3),
  exception_override: z.boolean().default(false),
  approval_reason: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/refund-requests")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const bucket = url.searchParams.get("bucket");
      const depId  = url.searchParams.get("deposit_id");
      const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      let sel: any = (serviceClient() as any).from("refund_request")
        .select("*, deposit:deposit_id(id, deposit_no, beneficiary_id, encounter_id, deposit_type, is_caution, method, amount_minor, available_minor, beneficiary:beneficiary_id(id, full_name, mrn))", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (status) sel = sel.eq("status", status);
      if (depId)  sel = sel.eq("deposit_id", depId);
      const { data, count, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      const rows = (data ?? []).map((r: any) => ({ ...r, bucket: bucketOfRefund(r) }));
      const filtered = bucket ? rows.filter((r: any) => r.bucket === bucket) : rows;
      const { data: all } = await (serviceClient() as any).from("refund_request").select("status").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = {};
      for (const r of (all ?? []) as any[]) {
        const b = bucketOfRefund(r);
        counts[b] = (counts[b] ?? 0) + 1;
      }
      return jsonData({ data: filtered, counts, pagination: { total: count ?? 0, limit, offset } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "refund.request" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Create.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: dep } = await db.from("deposit").select("id, tenant_id, method, available_minor")
        .eq("id", parsed.data.deposit_id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (!dep) return envelope("Deposit not found", "not_found", 404);
      if ((dep.available_minor ?? 0) < parsed.data.amount_minor) {
        return envelope("Insufficient available balance for refund", "DEPOSIT_OVERDRAW", 409);
      }
      const issues = validateRefundRequest({
        original_method: dep.method,
        refund_method: parsed.data.refund_method,
        exception_override: parsed.data.exception_override,
        approval_reason: parsed.data.approval_reason,
        reason: parsed.data.reason,
      });
      if (issues.length) return envelope(issues.map((i) => i.message).join("; "), issues[0].code, 409, { issues });

      const { data, error } = await db.from("refund_request").insert({
        tenant_id: auth.ctx.tenantId, deposit_id: dep.id,
        amount_minor: parsed.data.amount_minor, original_method: dep.method,
        refund_method: parsed.data.refund_method, reason: parsed.data.reason,
        exception_override: parsed.data.exception_override,
        approval_reason: parsed.data.approval_reason ?? null,
        status: "pending",
        created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "refund.request", "refund_request", data.id);
      return jsonData({ data }, 201);
    },
  } },
});