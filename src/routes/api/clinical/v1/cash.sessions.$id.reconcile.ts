import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Sign off a variance and mark session reconciled. */
const Body = z.object({ reason: z.string().optional() });

export const Route = createFileRoute("/api/clinical/v1/cash/sessions/$id/reconcile")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.session.reconcile" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("cash_session").update({
        status: "reconciled",
        notes: parsed.data.reason ?? null,
      }).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "cash.session.reconcile", "cash_session", params.id, { reason: parsed.data.reason });
      return jsonData({ data });
    },
  } },
});