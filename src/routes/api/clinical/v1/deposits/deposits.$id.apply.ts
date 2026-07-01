import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import { validateDepositApply } from "@/lib/rcm/validation";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R6 · Apply a deposit balance against a claim.
 * Caution deposits require `dep.override_caution` + reason `OVERRIDE:*`.
 * DB trigger updates `available_minor` and projects deposit status.
 */
const Body = z.object({
  amount_minor: z.number().int().positive(),
  claim_id: z.string().uuid(),
  reason: z.string().optional(),
  receipt_no: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/deposits/$id/apply")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "dep.apply" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: dep, error: e0 } = await db.from("deposit").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (e0 || !dep) return envelope("Deposit not found", "not_found", 404);
      const { data: claim, error: e1 } = await db.from("claim").select("id, tenant_id, status")
        .eq("id", parsed.data.claim_id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (e1 || !claim) return envelope("Claim not found", "not_found", 404);

      const issues = validateDepositApply(
        { is_caution: dep.is_caution, deposit_no: dep.deposit_no, available_minor: dep.available_minor },
        { amount_minor: parsed.data.amount_minor, reason: parsed.data.reason, approved_by: auth.ctx.userId },
      );
      if (issues.length) return envelope(issues.map((i) => i.message).join("; "), issues[0].code, 409, { issues });

      const { data: txn, error } = await db.from("deposit_transaction").insert({
        tenant_id: auth.ctx.tenantId,
        deposit_id: dep.id,
        txn_type: "apply",
        amount_minor: parsed.data.amount_minor,
        applied_to_claim_id: parsed.data.claim_id,
        reason: parsed.data.reason ?? null,
        receipt_no: parsed.data.receipt_no ?? null,
        approved_by: dep.is_caution ? auth.ctx.userId : null,
        created_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "deposit.apply", "deposit", dep.id, {
        claim_id: parsed.data.claim_id, amount_minor: parsed.data.amount_minor,
      });
      return jsonData({ data: txn }, 201);
    },
  } },
});