import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope } from "./_helpers";
import { ok } from "@/lib/rcm/scheduler";

const QuerySchema = z.object({
  date: z.string().optional(),        // ISO date; defaults to today
  clinic_id: z.string().uuid().optional(),
});

/**
 * GET /api/clinical/v1/scheduler/board
 * Returns { columns[], time_ticks[], slots_by_session, bookings_by_slot } for the day board.
 * capId: scheduler.board.read
 */
export const Route = createFileRoute("/api/clinical/v1/scheduler/board")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.board.read" });
      if (!auth.ok) return auth.res;

      const url = new URL(request.url);
      const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) return envelope("Bad query", "bad_query", 400);

      const day = parsed.data.date ? new Date(parsed.data.date) : new Date();
      const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);

      const db = serviceClient();

      // Sessions today (clinic_schedule + provider display name).
      let scheduleQ = db.from("clinic_schedule")
        .select("id, tenant_id, clinic_id, provider_id, slot_duration_min, priority_rank, specialty, overbook_allowed, overbook_limit, telemedicine_capable, procedure_room, wheelchair_access, female_clinic")
        .eq("tenant_id", auth.ctx.tenantId);
      if (parsed.data.clinic_id) scheduleQ = scheduleQ.eq("clinic_id", parsed.data.clinic_id);
      const { data: schedules, error: sErr } = await scheduleQ;
      if (sErr) return envelope("database_error", "db_error", 500);

      const providerIds = [...new Set((schedules ?? []).map((s) => s.provider_id).filter(Boolean))] as string[];
      const { data: providers } = providerIds.length
        ? await db.from("providers").select("id, display_name").in("id", providerIds)
        : { data: [] };
      const providerName = new Map((providers ?? []).map((p) => [p.id, p.display_name]));

      const columns = (schedules ?? []).map((s) => ({
        session_id: s.id,
        provider_display_name: providerName.get(s.provider_id ?? "") ?? "Provider",
        specialty: s.specialty,
        room: null as string | null,
        priority_rank: s.priority_rank ?? null,
        capacity: (s as { capacity_per_slot?: number }).capacity_per_slot ?? 1,
        booked_count: 0,
        overbook_limit: s.overbook_limit ?? 0,
        overbook_allowed: !!s.overbook_allowed,
        telemedicine_capable: !!s.telemedicine_capable,
        procedure_room: !!s.procedure_room,
        wheelchair_access: !!s.wheelchair_access,
        female_clinic: !!s.female_clinic,
      }));

      const scheduleIds = (schedules ?? []).map((s) => s.id);
      const { data: slots } = scheduleIds.length
        ? await db.from("clinic_slot")
            .select("id, schedule_id, slot_at, status, held_until, capacity, booked_count")
            .in("schedule_id", scheduleIds)
            .gte("slot_at", dayStart.toISOString())
            .lte("slot_at", dayEnd.toISOString())
            .order("slot_at", { ascending: true })
        : { data: [] };

      const slotsBySession: Record<string, Array<{ slot_at: string; slot: unknown }>> = {};
      const timeTickSet = new Set<string>();
      for (const s of slots ?? []) {
        const sid = s.schedule_id as string;
        (slotsBySession[sid] ||= []).push({ slot_at: s.slot_at, slot: s });
        timeTickSet.add(s.slot_at);
      }

      const { data: bookings } = scheduleIds.length
        ? await db.from("clinic_bookings")
            .select("id, schedule_id, slot_id, slot_at, status, no_show, overbooked, eligibility_check_pending, charge_mode, beneficiary_id, coverage_id")
            .in("schedule_id", scheduleIds)
            .gte("slot_at", dayStart.toISOString())
            .lte("slot_at", dayEnd.toISOString())
        : { data: [] };

      const bookingsBySlot: Record<string, unknown> = {};
      for (const b of bookings ?? []) {
        if (b.slot_id) bookingsBySlot[b.slot_id] = b;
      }

      return ok({
        columns,
        time_ticks: [...timeTickSet].sort(),
        slots_by_session: slotsBySession,
        bookings_by_slot: bookingsBySlot,
      });
    },
  } },
});