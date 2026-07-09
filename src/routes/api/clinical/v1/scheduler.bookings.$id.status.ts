import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope } from "./_helpers";
import { bounce, ok } from "@/lib/rcm/scheduler";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const StatusEnum = z.enum(["confirmed", "arrived", "in_consult", "completed", "no_show", "cancelled"]);
const Body = z.object({ status: StatusEnum, reason: z.string().optional() });
export type StatusBody = z.infer<typeof Body>;
export type SchedulerCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function handlePATCH(args: {
  params: { id: string };
  body: StatusBody;
  ctx: SchedulerCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { params, ctx, body } = args;
  const { data: booking } = await db.from("clinic_bookings")
    .select("id, slot_id, tenant_id, status, eligibility_check_pending")
    .eq("id", params.id).maybeSingle();
  if (!booking || booking.tenant_id !== ctx.tenantId) return bounce("NOT_FOUND");

  if (body.status === "confirmed" && booking.eligibility_check_pending) {
    return bounce("BOOKING_CONFIRM_ELIGIBILITY_PENDING");
  }

  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === "cancelled") patch.cancelled_at = new Date().toISOString();
  if (body.status === "confirmed") patch.confirmed_at = new Date().toISOString();
  if (body.status === "no_show")   patch.no_show = true;

  const { data: updated, error: uErr } = await db.from("clinic_bookings")
    .update(patch)
    .eq("id", params.id)
    .select("status, cancelled_at, confirmed_at, no_show")
    .single();
  if (uErr) return bounce("INVALID_STATUS_TRANSITION", { detail: uErr.message });

  const nowIso = new Date().toISOString();
  await db.from("booking_event").insert({
    tenant_id: ctx.tenantId, booking_id: params.id, event: body.status,
    by_user: ctx.userId, at: nowIso,
    payload: body.reason ? { reason: body.reason } : null,
  });

  if (body.status === "cancelled" && booking.slot_id) {
    await db.from("clinic_slot")
      .update({ status: "open", held_until: null })
      .eq("id", booking.slot_id)
      .eq("status", "booked");
  }

  return ok({ booking_id: params.id, ...updated });
}

export const Route = createFileRoute("/api/clinical/v1/scheduler/bookings/$id/status")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.book.write" });
      if (!auth.ok) return auth.res;
      let body: StatusBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePATCH({ params: { id: params.id }, body, ctx: auth.ctx });
    },
  } },
});