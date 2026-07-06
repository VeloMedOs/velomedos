import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Credit notes → wallet. Trigger `credit_note_apply` writes wallet_txn + ERP row. */
const Create = z.object({
  beneficiary_id: z.string().uuid(),
  encounter_id: z.string().uuid().nullable().optional(),
  amount_minor: z.number().int().positive(),
  reason: z.string().min(3),
  source_charge_ref: z.string().uuid().nullable().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/credit-notes")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const bId = url.searchParams.get("beneficiary_id");
      const eId = url.searchParams.get("encounter_id");
      const st  = url.searchParams.get("status");
      const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      let sel: any = (serviceClient() as any).from("credit_note")
        .select("*, beneficiary:beneficiary_id(id, full_name, mrn)", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (bId) sel = sel.eq("beneficiary_id", bId);
      if (eId) sel = sel.eq("encounter_id", eId);
      if (st)  sel = sel.eq("status", st);
      const { data, count, error } = await sel;
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [], pagination: { total: count ?? 0, limit, offset } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "credit_note.issue" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Create.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("credit_note").insert({
        tenant_id: auth.ctx.tenantId,
        beneficiary_id: parsed.data.beneficiary_id,
        encounter_id: parsed.data.encounter_id ?? null,
        amount_minor: parsed.data.amount_minor,
        reason: parsed.data.reason,
        source_charge_ref: parsed.data.source_charge_ref ?? null,
        status: "issued",
        created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "credit_note.issue", "credit_note", data.id);
      return jsonData({ data }, 201);
    },
  } },
});