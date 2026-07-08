import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope } from "./_helpers";
import { bounce, ok } from "@/lib/rcm/scheduler";

const Body = z.object({
  schedule_id: z.string().uuid(),
  slot_ids: z.array(z.string().uuid()).optional(),
  all_day: z.boolean().optional(),
  reason_code: z.string().min(1),
  note: z.string().optional(),
  notify_stakeholders: z.boolean().optional(),
});

/**
 * POST /api/clinical/v1/scheduler/blocks
 *
 * Inserts slot_block rows. Validates reason_code against
 * code_value/code_system(key='slot_block_reason') for a clean bounce
 * (the DB trigger enforces the same constraint).
 */
export const Route = createFileRoute("/api/clinical/v1/scheduler/blocks")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.block.write" });
      if (!auth.ok) return auth.res;
      let body: z.infer<typeof Body>;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }

      const db = serviceClient();

      const { data: cs } = await db.from("code_system").select("id").eq("key", "slot_block_reason").maybeSingle();
      if (!cs) return bounce("INVALID_BLOCK_REASON");
      const { data: allowed } = await db.from("code_value")
        .select("code").eq("code_system_id", cs.id).eq("code", body.reason_code).eq("active", true);
      if (!allowed || allowed.length === 0) return bounce("INVALID_BLOCK_REASON");

      const { data: schedule } = await db.from("clinic_schedule")
        .select("id, tenant_id").eq("id", body.schedule_id).maybeSingle();
      if (!schedule || schedule.tenant_id !== auth.ctx.tenantId) return bounce("NOT_FOUND");

      let slotIds = body.slot_ids ?? [];
      if (body.all_day) {
        const { data: slots } = await db.from("clinic_slot")
          .select("id").eq("schedule_id", body.schedule_id);
        slotIds = (slots ?? []).map((s) => s.id);
      }

      const base = {
        tenant_id: auth.ctx.tenantId,
        schedule_id: body.schedule_id,
        reason_code: body.reason_code,
        note: body.note ?? null,
        blocked_by: auth.ctx.userId,
        notify_stakeholders: !!body.notify_stakeholders,
      };
      const rows: Array<Record<string, unknown>> = slotIds.length
        ? slotIds.map((slot_id) => ({ ...base, slot_id }))
        : [{ ...base }];
      const { data: inserted, error: iErr } = await (db.from("slot_block") as unknown as {
        insert: (r: unknown) => { select: (c: string) => Promise<{ data: Array<{ id: string; slot_id: string | null }> | null; error: { message: string } | null }> };
      }).insert(rows).select("id, slot_id");
      if (iErr) return envelope("database_error", "db_error", 500, { detail: iErr.message });

      if (slotIds.length) {
        await db.from("clinic_slot").update({ status: "blocked" }).in("id", slotIds);
      }

      if (body.notify_stakeholders && slotIds.length) {
        const { data: bkngs } = await db.from("clinic_bookings")
          .select("id").in("slot_id", slotIds);
        if (bkngs?.length) {
          await db.from("booking_event").insert(
            bkngs.map((b) => ({
              tenant_id: auth.ctx.tenantId, booking_id: b.id, event: "block_notified",
              by_user: auth.ctx.userId, at: new Date().toISOString(),
              payload: { reason_code: body.reason_code, note: body.note ?? null },
            })),
          );
        }
      }

      return ok({ blocks: inserted ?? [] });
    },
  } },
});