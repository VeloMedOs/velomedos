import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Attach a receipt/ID/consent file to a deposit for audit. */
const Body = z.object({
  kind: z.enum(["receipt","id_document","consent","refund_slip","other"]).default("receipt"),
  url: z.string().url(),
  note: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/deposits/deposits/$id/attachments")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds", { capId: "dep.collect" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("deposit_attachment").insert({
        tenant_id: auth.ctx.tenantId, deposit_id: params.id,
        kind: parsed.data.kind, url: parsed.data.url, note: parsed.data.note ?? null,
        uploaded_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "deposit.attach", "deposit", params.id, { kind: parsed.data.kind });
      return jsonData({ data }, 201);
    },
  } },
});