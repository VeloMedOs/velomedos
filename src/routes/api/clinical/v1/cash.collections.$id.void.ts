import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Void a posted collection (compensating session_txn out). */
const Body = z.object({ reason: z.string().min(3) });

export const Route = createFileRoute("/api/clinical/v1/cash/collections/$id/void")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.void" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: row, error: e0 } = await db.from("cash_collection").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (e0 || !row) return envelope("Collection not found", "not_found", 404);
      if (row.status === "voided") return envelope("Already voided", "invalid_state", 409);
      const { data: updated, error } = await db.from("cash_collection").update({
        status: "voided", voided_at: new Date().toISOString(), void_reason: parsed.data.reason,
      }).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      if (row.session_id) {
        await db.from("cash_session_txn").insert({
          tenant_id: auth.ctx.tenantId, session_id: row.session_id,
          txn_kind: "adjustment", cash_collection_id: row.id,
          method: row.method, amount_minor: row.net_collected_minor, direction: "out",
        });
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "cash.collection.void", "cash_collection", params.id, { reason: parsed.data.reason });
      return jsonData({ data: updated });
    },
  } },
});