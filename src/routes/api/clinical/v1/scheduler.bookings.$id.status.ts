import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope } from "./_helpers";
import { bounce, ok } from "@/lib/rcm/scheduler";

const StatusEnum = z.enum(["confirmed", "arrived", "in_consult", "completed", "no_show", "cancelled"]);
const Body = z.object({ status: StatusEnum, reason: z.string().optional() });

export const Route = createFileRoute("/api/clinical/v1/scheduler/bookings/$id/status")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.book.write" });
      if (!auth.ok) return auth.res;
      let body: z.infer<typeof Body>;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }

      const db = serviceClient();
      const { data: booking } = await db.from("clinic_bookings")
        .select("id, slot_id, tenant_id, status, eligibility_check_pending")
        .eq("id", params.id).maybeSingle();
      if (!booking || booking.tenant_id !== auth.ctx.tenantId) return bounce("NOT_FOUND");

      if (body.status === "confirmed" && booking.eligibility_check_pending) {
        return bounce("BOOKING_CONFIRM_ELIGIBILITY_PENDING");
      }

      const { data: updated, error: uErr } = await db.from("clinic_bookings")
        .update({ status: body.status })
        .eq("id", params.id)
        .select("status, cancelled_at, confirmed_at, no_show")
        .single();
      if (uErr) return bounce("INVALID_STATUS_TRANSITION", { detail: uErr.message });

      const nowIso = new Date().toISOString();
      await db.from("booking_event").insert({
        tenant_id: auth.ctx.tenantId, booking_id: params.id, event: body.status,
        by_user: auth.ctx.userId, at: nowIso,
        payload: body.reason ? { reason: body.reason } : null,
      });

      if (body.status === "cancelled" && booking.slot_id) {
        await db.from("clinic_slot")
          .update({ status: "open", held_until: null })
          .eq("id", booking.slot_id)
          .eq("status", "booked");
      }

      return ok({ booking_id: params.id, ...updated });
    },
  } },
});