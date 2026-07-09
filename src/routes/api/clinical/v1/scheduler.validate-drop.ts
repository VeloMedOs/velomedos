import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";
import { bounce } from "@/lib/rcm/scheduler";
import { evaluateTriggers, foldTriggerOutcome } from "@/lib/mds/rules";
import { canPerform, type ClinicalRole } from "@/lib/clinical-role-matrix";

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
export type ValidateDropBody = z.infer<typeof Body>;

/** Step 3 · Turn 4 — pure fixture-friendly handler. See Route below for the wrapper. */
export type SchedulerCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function handlePOST(args: {
  body: ValidateDropBody;
  ctx: SchedulerCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const body = args.body;
  const ctx = args.ctx;

  const { data: slot } = await db.from("clinic_slot")
    .select("id, schedule_id, slot_at, status, capacity, booked_count, tenant_id")
    .eq("id", body.slot_id).maybeSingle();
  if (!slot || slot.tenant_id !== ctx.tenantId) return envelope("slot not found", "not_found", 404);

  const { data: schedule } = await db.from("clinic_schedule")
    .select("id, slot_duration_min, overbook_allowed, overbook_limit, female_clinic, specialty, clinic_id, provider_id, age_min, age_max")
    .eq("id", slot.schedule_id).maybeSingle();
  if (!schedule) return envelope("schedule not found", "not_found", 404);

  const { data: bene } = await db.from("beneficiary")
    .select("id, tenant_id, gender, dob")
    .eq("id", body.beneficiary_id).maybeSingle();
  if (!bene || bene.tenant_id !== ctx.tenantId) return envelope("beneficiary not found", "not_found", 404);

  // 1. Capacity / overbook (DD5 two-path).
  const cap = slot.capacity ?? 1;
  const used = slot.booked_count ?? 0;
  const limit = schedule.overbook_limit ?? 0;
  const hasOverbook = canPerform(ctx.clinicalRole, "scheduler.overbook");
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
  let svcSubCategory: string | null = null;
  if (body.service_id) {
    const { data: svc } = await db.from("service_master")
      .select("approx_perform_minutes, sub_category").eq("id", body.service_id).maybeSingle();
    if (svc?.approx_perform_minutes && svc.approx_perform_minutes > 0) durMin = svc.approx_perform_minutes;
    svcSubCategory = (svc?.sub_category as string | undefined) ?? null;
  }
  if (durMin > schedule.slot_duration_min) return bounce("SLOT_VISIT_DURATION_EXCEEDS");

  // 3. OR/Cath restriction — active slot_block reason_code='or_case' on this schedule.
  const { data: orBlocks } = await db.from("slot_block")
    .select("id, reason_code")
    .eq("schedule_id", schedule.id)
    .eq("reason_code", "or_case");
  if ((orBlocks?.length ?? 0) > 0) return bounce("SLOT_OR_RESTRICTED");

  // 4a. Gender / ♀-clinic.
  if (schedule.female_clinic && bene.gender && bene.gender !== "female") {
    return bounce("SLOT_GENDER_MISMATCH");
  }

  // 4b. Age range.
  if (bene.dob && (schedule.age_min != null || schedule.age_max != null)) {
    const ageYrs = (Date.now() - new Date(bene.dob).getTime()) / (365.25 * 86400_000);
    if (schedule.age_min != null && ageYrs < schedule.age_min) return bounce("SLOT_AGE_OUT_OF_RANGE");
    if (schedule.age_max != null && ageYrs > schedule.age_max) return bounce("SLOT_AGE_OUT_OF_RANGE");
  }

  // 5. Rules B/C — DISPLAY-only charge_mode. Never bounces.
  let charge_mode: "new_consult" | "follow_up" | "series" | "no_charge" | null = null;
  const { data: rules } = await db.from("pricing_rule")
    .select("id, name, scope, priority, condition, action, tenant_id, active")
    .eq("scope", "referral")
    .eq("active", true)
    .or(`tenant_id.eq.${ctx.tenantId},tenant_id.is.null`);
  const targetSpecialty = schedule.specialty ?? "";
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
    (rules ?? []).map((r: any) => ({
      id: r.id, name: r.name, scope: r.scope as "referral",
      priority: r.priority, condition: r.condition as Record<string, unknown>,
      action: r.action as Record<string, unknown>, tenant_id: r.tenant_id, active: r.active,
    })),
    {
      target_specialty: targetSpecialty,
      days_since_last_visit: daysSinceLast,
      visit_type: body.visit_type,
      overbook: overbooked_flag,
      sub_category: svcSubCategory,
    } as unknown as Record<string, unknown>,
    "referral",
  );
  const folded = foldTriggerOutcome(hits, { target_specialty: targetSpecialty, sub_category: svcSubCategory });
  charge_mode = folded.charge_mode;

  // 6. Eligibility gating (post-book only).
  const eligibility_check_pending = !!body.coverage_id;

  // 6b. ANC cadence suggestion (JJ2 · advisory display fact — never bounces).
  // Attached when beneficiary has an active pregnancy episode AND the target
  // clinic is OBS&GYN. Uses episode_of_care.end_date as EDD.
  let anc_cadence_suggestion: {
    edd: string;
    cadence: string;
    next_visit_by: string;
  } | null = null;
  const specStr = (schedule.specialty ?? "").toLowerCase();
  const scheduleIsObs = specStr.includes("obs") || specStr.includes("gyn");
  if (scheduleIsObs) {
    const { data: preg } = await db.from("episode_of_care")
      .select("id, end_date, status, care_type, tenant_id")
      .eq("beneficiary_id", body.beneficiary_id)
      .eq("care_type", "pregnancy")
      .eq("status", "active")
      .maybeSingle();
    if (preg && preg.tenant_id === ctx.tenantId && preg.end_date) {
      const edd = new Date(preg.end_date as string);
      const slotDate = new Date(slot.slot_at);
      const twoWeekWindowStart = new Date(edd.getTime() - 90 * 86400_000); // EDD - 3mo
      const monthly = slotDate < twoWeekWindowStart;
      const nextDays = monthly ? 28 : 14;
      const next = new Date(slotDate.getTime() + nextDays * 86400_000);
      anc_cadence_suggestion = {
        edd: preg.end_date as string,
        cadence: monthly ? "monthly" : "2-weekly",
        next_visit_by: next.toISOString().slice(0, 10),
      };
    }
  }

  // Atomic held-slot claim.
  const heldUntil = new Date(Date.now() + 90_000).toISOString();
  const { data: held, error: hErr } = await db.from("clinic_slot")
    .update({ status: "held", held_until: heldUntil })
    .eq("id", body.slot_id)
    .eq("status", "open")
    .select("id, held_until");
  if (hErr) return envelope("database_error", "db_error", 500);
  if (!held || held.length === 0) return bounce("SLOT_JUST_TAKEN");

  const { data: booking, error: bErr } = await db.from("clinic_bookings")
    .insert({
      tenant_id: ctx.tenantId,
      clinic_id: schedule.clinic_id,
      schedule_id: schedule.id,
      slot_id: slot.id,
      slot_at: slot.slot_at,
      beneficiary_id: bene.id,
      coverage_id: body.coverage_id ?? null,
      source: body.source,
      visit_type: body.visit_type,
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
    await db.from("clinic_slot").update({ status: "open", held_until: null })
      .eq("id", body.slot_id).eq("status", "held");
    return envelope("booking_insert_failed", "db_error", 500, { detail: bErr?.message });
  }

  await db.from("booking_event").insert({
    tenant_id: ctx.tenantId, booking_id: booking.id, event: "requested",
    by_user: ctx.userId, at: new Date().toISOString(),
  });

  return jsonData({
    ok: true,
    data: { booking_id: booking.id, slot_id: slot.id, held_until: heldUntil, charge_mode, eligibility_check_pending, overbook_warning, anc_cadence_suggestion },
    overbook_warning,
    request_id: crypto.randomUUID(),
  });
}

/**
 * POST /api/clinical/v1/scheduler/validate-drop — see handlePOST for the
 * sequenced business checks + atomic held-slot claim.
 */
export const Route = createFileRoute("/api/clinical/v1/scheduler/validate-drop")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.book.write" });
      if (!auth.ok) return auth.res;
      let body: ValidateDropBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});
