/**
 * Step 4 · Turn 4 — Close pregnancy episode on chart-close (D7).
 * Sets episode_of_care.status='delivered' + end_date (defaults to today).
 * Idempotent: re-close returns the same row.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Body = z.object({
  episode_id: z.string().uuid(),
  end_date: z.string().optional(),
});
export type DeliveryCloseBody = z.infer<typeof Body>;

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handlePOST(args: {
  body: DeliveryCloseBody;
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { data: eoc } = await db.from("episode_of_care")
    .select("id, tenant_id, status, end_date, care_type").eq("id", args.body.episode_id).maybeSingle();
  if (!eoc || eoc.tenant_id !== args.ctx.tenantId) return envelope("episode not found", "not_found", 404);
  if (eoc.care_type !== "pregnancy") return envelope("not a pregnancy episode", "invalid_state", 400);

  if (eoc.status === "delivered") {
    return jsonData({ ok: true, data: { episode_id: eoc.id, status: eoc.status, end_date: eoc.end_date }, request_id: crypto.randomUUID() });
  }

  const end = args.body.end_date ?? new Date().toISOString().slice(0, 10);
  const { data: updated, error } = await db.from("episode_of_care")
    .update({ status: "delivered", end_date: end })
    .eq("id", args.body.episode_id)
    .select("id, status, end_date").maybeSingle();
  if (error) return envelope(error.message ?? "database_error", "db_error", 400);

  return jsonData({
    ok: true,
    data: { episode_id: (updated as any).id, status: (updated as any).status, end_date: (updated as any).end_date },
    request_id: crypto.randomUUID(),
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/maternity/delivery-close")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.maternity.close" });
      if (!auth.ok) return auth.res;
      const raw = await request.json().catch(() => ({}));
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return envelope("invalid body", "invalid_input", 400);
      return handlePOST({ body: parsed.data, ctx: auth.ctx });
    },
  } },
});