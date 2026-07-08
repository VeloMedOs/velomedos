import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";
import { bounce } from "@/lib/rcm/scheduler";
import { evaluateTriggers, foldTriggerOutcome } from "@/lib/mds/rules";
import { canPerform } from "@/lib/clinical-role-matrix";

const Body = z.object({
  session_id: z.string().uuid(),
  slot_id: z.string().uuid(),
  beneficiary_id: z.string().uuid(),
  visit_type: z.enum(["new_consult", "follow_up", "series", "no_charge", "procedure"]).default("new_consult"),
  service_id: z.string().uuid().optional(),
  coverage_id: z.string().uuid().nullable().optional(),
  source: z.enum(["walk_in", "scheduled", "er_referral", "ip_followup", "referral", "external", "marketing"]).default("scheduled"),
  referral_target_id: z.string().uuid().nullable().optional(),
});

/**
 * POST /api/clinical/v1/scheduler/validate-drop
 *
 * Sequenced business checks + atomic held-slot claim.
 *   1. Capacity / overbook (DD5 two-path):
 *        (a) below capacity → ok, overbook_warning=false
 *        (b) below capacity+limit AND allowed AND caller has overbook → ok, overbook_warning=true
 *        (c) else → 422 slot_capacity_full
 *   2. Visit duration fits (approx_perform_minutes ?? slot_duration_min)
 *   3. OR/Cath restriction (slot_block reason_code='or_case' active on schedule)
 *   4. Gender / age  (♀-clinic and age_min/max on schedule when present)
 *   5. evaluateTriggers scope='referral' — DISPLAY-only, populates charge_mode
 *   6. Eligibility: coverage_id ⇒ eligibility_check_pending=true. NEVER calls NPHIES from here.
 *
 * Atomic hold:
 *   UPDATE clinic_slot SET status='held', held_until=now()+90s WHERE id=? AND status='open' RETURNING id
 *   Zero rows ⇒ 409 slot_just_taken.
 */
export const Route = createFileRoute("/api/clinical/v1/scheduler/validate-drop")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.book.write" });
      if (!auth.ok) return auth.res;

      let body: z.infer<typeof Body>;
      try {
        body = Body.parse(await request.json());
      } catch (e) {
        return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message });
      }

      const db = serviceClient();

      // Load schedule + slot.
      const { data: slot } = await db.from("clinic_slot")
        .select("id, schedule_id, slot_at, status, capacity, booked_count, tenant_id")
        .eq("id", body.slot_id).maybeSingle();
      if (!slot || slot.tenant_id !== auth.ctx.tenantId) return envelope("slot not found", "not_found", 404);

      const { data: schedule } = await db.from("clinic_schedule")
        .select("id, slot_duration_min, overbook_allowed, overbook_limit, female_clinic, specialty, clinic_id, provider_id")
        .eq("id", slot.schedule_id).maybeSingle();
      if (!schedule) return envelope("schedule not found", "not_found", 404);

      const { data: bene } = await db.from("beneficiary")
        .select("id, tenant_id, gender, dob")
        .eq("id", body.beneficiary_id).maybeSingle();
      if (!bene || bene.tenant_id !== auth.ctx.tenantId) return envelope("beneficiary not found", "not_found", 404);

      // 1. Capacity / overbook (two paths).
      const cap = slot.capacity ?? 1;
      const used = slot.booked_count ?? 0;
      const limit = schedule.overbook_limit ?? 0;
      const hasOverbook = canPerform(auth.ctx.clinicalRole, "scheduler.overbook");
      let overbook_warning = false;
      let overbooked_flag = false;
      if (used >= cap) {
        if (used >= cap + limit || !schedule.overbook_allowed || !hasOverbook) {
          return bounce("SLOT_CAPACITY_FULL");
        }
        overbook_warning = true;
        overbooked_flag = true;
      }

      // 2. Visit duration fits.
      let durMin: number = schedule.slot_duration_min;
      if (body.service_id) {
        const { data: svc } = await db.from("service_master")
          .select("approx_perform_minutes").eq("id", body.service_id).maybeSingle();
        if (svc?.approx_perform_minutes && svc.approx_perform_minutes > 0) durMin = svc.approx_perform_minutes;
      }
      if (durMin > schedule.slot_duration_min) return bounce("SLOT_VISIT_DURATION_EXCEEDS");

      // 3. OR/Cath restriction — an active slot_block reason_code='or_case' on this schedule.
      const { data: orBlocks } = await db.from("slot_block")
        .select("id, reason_code")
        .eq("schedule_id", schedule.id)
        .eq("reason_code", "or_case");
      if ((orBlocks?.length ?? 0) > 0) return bounce("SLOT_OR_RESTRICTED");

      // 4. Gender / ♀-clinic.
      if (schedule.female_clinic && bene.gender && bene.gender !== "female") {
        return bounce("SLOT_GENDER_MISMATCH");
      }

      // 5. Rules B/C — DISPLAY-only charge_mode. Never bounces.
      let charge_mode: "new_consult" | "follow_up" | "series" | "no_charge" | null = null;
      const { data: rules } = await db.from("pricing_rule")
        .select("id, name, scope, priority, condition, action, tenant_id, active")
        .eq("scope", "referral")
        .eq("active", true)
        .or(`tenant_id.eq.${auth.ctx.tenantId},tenant_id.is.null`);
      const targetSpecialty = schedule.specialty ?? "";
      // 14-day window: look for a prior booking of same beneficiary in same specialty.
      const cutoff14 = new Date(Date.now() - 14 * 86400_000).toISOString();
      const { data: prior } = await db.from("clinic_bookings")
        .select("id, slot_at, schedule:schedule_id (specialty)")
        .eq("beneficiary_id", body.beneficiary_id)
        .gte("slot_at", cutoff14)
        .in("status", ["confirmed", "arrived", "in_consult", "completed"]);
      const daysSinceLast = ((prior ?? []) as unknown as Array<{ slot_at: string; schedule: { specialty: string | null } | null }>)
        .filter((p) => (p.schedule?.specialty ?? "") === targetSpecialty)
        .map((p) => (Date.now() - new Date(p.slot_at).getTime()) / 86400_000)
        .sort((a, b) => a - b)[0];
      const hits = evaluateTriggers(
        (rules ?? []).map((r) => ({
          id: r.id, name: r.name, scope: r.scope as "referral",
          priority: r.priority, condition: r.condition as Record<string, unknown>,
          action: r.action as Record<string, unknown>, tenant_id: r.tenant_id, active: r.active,
        })),
        {
          target_specialty: targetSpecialty,
          days_since_last_visit: daysSinceLast,
          visit_type: body.visit_type,
          overbook: overbooked_flag,
        } as unknown as Record<string, unknown>,
        "referral",
      );
      const folded = foldTriggerOutcome(hits, { target_specialty: targetSpecialty });
      charge_mode = folded.charge_mode;

      // 6. Eligibility gating (post-book only).
      const eligibility_check_pending = !!body.coverage_id;

      // Atomic held-slot claim.
      const heldUntil = new Date(Date.now() + 90_000).toISOString();
      const { data: held, error: hErr } = await db.from("clinic_slot")
        .update({ status: "held", held_until: heldUntil })
        .eq("id", body.slot_id)
        .eq("status", "open")
        .select("id, held_until");
      if (hErr) return envelope("database_error", "db_error", 500);
      if (!held || held.length === 0) return bounce("SLOT_JUST_TAKEN");

      // Insert booking (status='requested').
      const { data: booking, error: bErr } = await db.from("clinic_bookings")
        .insert({
          tenant_id: auth.ctx.tenantId,
          clinic_id: schedule.clinic_id,
          schedule_id: schedule.id,
          slot_id: slot.id,
          slot_at: slot.slot_at,
          beneficiary_id: bene.id,
          coverage_id: body.coverage_id ?? null,
          source: body.source,
          visit_type: body.visit_type as "new_consult" | "follow_up" | "series" | "no_charge" | "procedure",
          referral_target_id: body.referral_target_id ?? null,
          overbooked: overbooked_flag,
          eligibility_check_pending,
          charge_mode,
          kind: "in_person",
          status: "requested",
        })
        .select("id")
        .single();
      if (bErr || !booking) {
        // Best-effort release the hold if insert failed.
        await db.from("clinic_slot").update({ status: "open", held_until: null })
          .eq("id", body.slot_id).eq("status", "held");
        return envelope("booking_insert_failed", "db_error", 500, { detail: bErr?.message });
      }

      await db.from("booking_event").insert({
        tenant_id: auth.ctx.tenantId, booking_id: booking.id, event: "requested",
        by_user: auth.ctx.userId, at: new Date().toISOString(),
      });

      return jsonData({
        ok: true,
        data: { booking_id: booking.id, slot_id: slot.id, held_until: heldUntil, charge_mode, eligibility_check_pending },
        overbook_warning,
        request_id: crypto.randomUUID(),
      });
    },
  } },
});