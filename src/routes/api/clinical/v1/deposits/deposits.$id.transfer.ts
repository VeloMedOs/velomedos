import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Transfer deposit balance across encounters/beneficiaries. Reason mandatory. */
const Body = z.object({
  amount_minor: z.number().int().positive(),
  target_encounter_id: z.string().uuid().nullable().optional(),
  target_beneficiary_id: z.string().uuid().nullable().optional(),
  reason: z.string().min(3),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/deposits/$id/transfer")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "dep.transfer" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: dep } = await db.from("deposit").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (!dep) return envelope("Deposit not found", "not_found", 404);
      if ((dep.available_minor ?? 0) < parsed.data.amount_minor) {
        return envelope("Insufficient balance for transfer", "DEPOSIT_OVERDRAW", 409);
      }
      const { data: txn, error } = await db.from("deposit_transaction").insert({
        tenant_id: auth.ctx.tenantId, deposit_id: dep.id, txn_type: "transfer",
        amount_minor: parsed.data.amount_minor,
        reason: JSON.stringify({
          note: parsed.data.reason,
          target_encounter_id: parsed.data.target_encounter_id ?? null,
          target_beneficiary_id: parsed.data.target_beneficiary_id ?? null,
        }),
        approved_by: auth.ctx.userId, created_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "deposit.transfer", "deposit", dep.id, {
        amount_minor: parsed.data.amount_minor, reason: parsed.data.reason,
      });
      return jsonData({ data: txn }, 201);
    },
  } },
});