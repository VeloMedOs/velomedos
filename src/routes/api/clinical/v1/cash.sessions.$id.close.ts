import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R7 · Close a cash session — records counted totals by method, calculates
 * variance vs expected. Variance ≠ 0 sets status=over_short (needs reconcile).
 * Trigger `trg_cash_session_on_close` computes variance_minor server-side.
 */
const Body = z.object({
  counted_minor: z.record(z.string(), z.number().int().min(0)),
  note: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/cash/sessions/$id/close")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.session.close" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: session, error: e0 } = await db.from("cash_session").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (e0 || !session) return envelope("Session not found", "not_found", 404);
      if (session.status !== "open") return envelope("Session not open", "invalid_state", 409);
      const totalCounted = Object.values(parsed.data.counted_minor).reduce((s, n) => s + n, 0);
      const { data, error } = await db.from("cash_session").update({
        status: "closing",
        closed_at: new Date().toISOString(),
        counted_minor: totalCounted,
        notes: parsed.data.note ?? session.notes,
      }).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "cash.session.close", "cash_session", params.id, {
        counted_minor: parsed.data.counted_minor, total_counted: totalCounted,
      });
      return jsonData({ data });
    },
  } },
});