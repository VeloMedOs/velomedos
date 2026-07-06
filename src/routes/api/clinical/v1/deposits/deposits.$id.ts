import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Single deposit — GET aggregates txns + attachments; PATCH mutates safe metadata only. */
const Patch = z.object({
  notes: z.string().nullable().optional(),
  reference_no: z.string().nullable().optional(),
  pos_reference: z.string().nullable().optional(),
  status: z.enum(["held","collected","cancelled"]).optional(),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/deposits/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: row, error } = await db.from("deposit").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (error || !row) return envelope("Deposit not found", "not_found", 404);
      const [{ data: txns }, { data: attachments }] = await Promise.all([
        db.from("deposit_transaction").select("*").eq("deposit_id", row.id).order("created_at", { ascending: true }),
        db.from("deposit_attachment").select("*").eq("deposit_id", row.id).order("created_at", { ascending: true }),
      ]);
      return jsonData({ data: { row, txns: txns ?? [], attachments: attachments ?? [] } });
    },
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "dep.collect" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Patch.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const patch: any = { ...parsed.data, updated_by: auth.ctx.userId };
      const { data, error } = await db.from("deposit").update(patch)
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId)
        .select("*").maybeSingle();
      if (error) return envelope("database_error", "db_error", 400);
      if (!data) return envelope("Deposit not found", "not_found", 404);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "deposit.patch", "deposit", data.id, parsed.data);
      return jsonData({ data });
    },
  } },
});