import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope } from "./_helpers";
import { ok } from "@/lib/rcm/scheduler";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type SchedulerCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Step 3 · Turn 5 — pure fixture-friendly handler. See Route below for the wrapper.
 */
export async function handleGET(args: {
  ctx: SchedulerCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const ctx = args.ctx;
  const rows: Array<{
    request_id: string | null;
    kind: "referral" | "anc_followup" | "rebook" | "portal";
    target_specialty: string | null;
    referral_id: string | null;
    mrn: string | null;
    full_name: string | null;
    contact_number: string | null;
    dob: string | null;
    gender: string | null;
  }> = [];

  // (a) Referrals awaiting appointment.
  const { data: refs, error: rErr } = await db
    .from("referral_target")
    .select("id, referral_id, target_kind, target_specialty, status, referral:referral_id ( id, source_encounter_id, encounter:source_encounter_id ( beneficiary_id, beneficiary:beneficiary_id ( patient_file_no, full_name, contact_number, dob, gender ) ) )")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["submitted", "accepted"])
    .is("booked_appointment_id", null)
    .eq("target_kind", "specialty");
  if (rErr) return envelope("database_error", "db_error", 500);
  for (const rt of (refs ?? []) as unknown as Array<{
    id: string; referral_id: string; target_specialty: string | null;
    referral: { encounter: { beneficiary: { patient_file_no: string; full_name: string; contact_number: string | null; dob: string | null; gender: string | null } | null } | null } | null;
  }>) {
    const b = rt.referral?.encounter?.beneficiary ?? null;
    rows.push({
      request_id: rt.id, kind: "referral", target_specialty: rt.target_specialty ?? null,
      referral_id: rt.referral_id, mrn: b?.patient_file_no ?? null, full_name: b?.full_name ?? null,
      contact_number: b?.contact_number ?? null, dob: b?.dob ?? null, gender: b?.gender ?? null,
    });
  }

  // (b) ANC follow-ups — placeholder (debt #21).

  // (c) Rebooks (30-day window).
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: rebs } = await db
    .from("clinic_bookings")
    .select("id, schedule_id, cancelled_at, no_show, rebook_request, beneficiary_id, schedule:schedule_id ( specialty ), beneficiary:beneficiary_id ( patient_file_no, full_name, contact_number, dob, gender )")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "cancelled")
    .eq("no_show", false)
    .eq("rebook_request", true)
    .gte("cancelled_at", cutoff);
  for (const cb of (rebs ?? []) as unknown as Array<{
    id: string; schedule: { specialty: string | null } | null;
    beneficiary: { patient_file_no: string; full_name: string; contact_number: string | null; dob: string | null; gender: string | null } | null;
  }>) {
    rows.push({
      request_id: cb.id, kind: "rebook", target_specialty: cb.schedule?.specialty ?? null,
      referral_id: null, mrn: cb.beneficiary?.patient_file_no ?? null,
      full_name: cb.beneficiary?.full_name ?? null, contact_number: cb.beneficiary?.contact_number ?? null,
      dob: cb.beneficiary?.dob ?? null, gender: cb.beneficiary?.gender ?? null,
    });
  }

  // (d) Portal / marketing not-yet-confirmed.
  const { data: portal } = await db
    .from("clinic_bookings")
    .select("id, schedule_id, schedule:schedule_id ( specialty ), beneficiary:beneficiary_id ( patient_file_no, full_name, contact_number, dob, gender )")
    .eq("tenant_id", ctx.tenantId)
    .eq("source", "marketing")
    .is("confirmed_at", null);
  for (const cb of (portal ?? []) as unknown as Array<{
    id: string; schedule: { specialty: string | null } | null;
    beneficiary: { patient_file_no: string; full_name: string; contact_number: string | null; dob: string | null; gender: string | null } | null;
  }>) {
    rows.push({
      request_id: cb.id, kind: "portal", target_specialty: cb.schedule?.specialty ?? null,
      referral_id: null, mrn: cb.beneficiary?.patient_file_no ?? null,
      full_name: cb.beneficiary?.full_name ?? null, contact_number: cb.beneficiary?.contact_number ?? null,
      dob: cb.beneficiary?.dob ?? null, gender: cb.beneficiary?.gender ?? null,
    });
  }

  return ok({ rows });
}

/**
 * GET /api/clinical/v1/scheduler/booking-requests
 *
 * Feeds the day-board left rail. Four-clause UNION per DD3:
 *   (a) referrals awaiting appointment (referral_target.status='requested')
 *   (b) ANC follow-ups — PLACEHOLDER; empty until maternity_protocol.next_anc_due_at
 *       lands in Batch C Maternity (debt #21).
 *   (c) rebooks from cancellations (rebook_request = true, ≤ 30 days)
 *   (d) portal / marketing bookings not yet confirmed
 *
 * MRN is `beneficiary.patient_file_no AS mrn` in every clause per Step 2 convention.
 */
export const Route = createFileRoute("/api/clinical/v1/scheduler/booking-requests")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "scheduler.board.read" });
      if (!auth.ok) return auth.res;
      return handleGET({ ctx: auth.ctx });
    },
  } },
});