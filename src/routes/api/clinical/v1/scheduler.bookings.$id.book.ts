import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope } from "./_helpers";
import { bounce, ok } from "@/lib/rcm/scheduler";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Body = z.object({ hold_token: z.string().optional() });
export type BookBody = z.infer<typeof Body>;
export type SchedulerCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Step 3 · Turn 4 — pure fixture-friendly handler. */
export async function handlePOST(args: {
  params: { id: string };
  body: BookBody;
  ctx: SchedulerCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { params, ctx } = args;
  const { data: booking } = await db.from("clinic_bookings")
    .select("id, slot_id, tenant_id")
    .eq("id", params.id).maybeSingle();
  if (!booking || booking.tenant_id !== ctx.tenantId || !booking.slot_id) return bounce("NOT_FOUND");

  const nowIso = new Date().toISOString();
  const { data: claimed } = await db.from("clinic_slot")
    .update({ status: "booked", held_until: null })
    .eq("id", booking.slot_id)
    .eq("status", "held")
    .gt("held_until", nowIso)
    .select("id");
  if (!claimed || claimed.length === 0) return bounce("SLOT_UNAVAILABLE");

  await db.from("clinic_bookings").update({ status: "requested" }).eq("id", params.id);
  await db.from("booking_event").insert({
    tenant_id: ctx.tenantId, booking_id: params.id, event: "booked",
    by_user: ctx.userId, at: nowIso,
  });
  return ok({ booking_id: params.id, slot_id: booking.slot_id });
}

/**
 * POST /api/clinical/v1/scheduler/bookings/:id/book
 *
 * Atomic held-slot commit. The slot must still be `held` AND `held_until > now()`.
 * Race losers get SLOT_UNAVAILABLE.
 */
export const Route = createFileRoute("/api/clinical/v1/scheduler/bookings/$id/book")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.book.write" });
      if (!auth.ok) return auth.res;
      let body: BookBody;
      try { body = Body.parse(await request.json().catch(() => ({}))); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ params: { id: params.id }, body, ctx: auth.ctx });
    },
  } },
});