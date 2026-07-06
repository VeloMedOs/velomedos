import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Patch = z.object({
  status: z.enum(["requested","collected","applied","refunded","cancelled"]).optional(),
  amount_minor: z.number().int().min(0).optional(),
  method: z.enum(["cash","card","bank_transfer","wallet","insurance"]).optional(),
  reference_no: z.string().nullable().optional(),
  applied_to_bill_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

export const Route = createFileRoute("/api/clinical/v1/ip/deposits/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const own = await loadOwned<any>("deposit", params.id, auth.ctx.tenantId);
      if (!own.ok) return own.res;
      return jsonData({ data: own.row });
    },
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin","cashier","biller","rcm","finance"]);
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Patch.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const own = await loadOwned<any>("deposit", params.id, auth.ctx.tenantId);
      if (!own.ok) return own.res;
      const db = serviceClient() as any;
      const upd: Record<string, unknown> = { ...parsed.data, updated_by: auth.ctx.userId };
      if (parsed.data.status === "collected" && !own.row.received_at) {
        upd.received_by = auth.ctx.userId; upd.received_at = new Date().toISOString();
      }
      const { data, error } = await db.from("deposit")
        .update(upd).eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "deposit.update", "deposit", params.id,
        { status: parsed.data.status });
      return jsonData({ data });
    },
  } },
});