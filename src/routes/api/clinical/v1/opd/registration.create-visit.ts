import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import { sendVisitConfirmation } from "@/lib/interface/sms-gateway";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Body = z.object({
  beneficiary_id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  provider_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(0).max(9).optional(),
  specialty: z.string().nullable().optional(),
});
export type CreateVisitBody = z.infer<typeof Body>;
export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

const STALE_HOURS = 24;

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HCA-0946/0947 · E2b · Create OPD walk-in visit.
 *
 * Gate: MUST find a `visit_eligibility` row for (beneficiary, tenant) that is
 * newer than STALE_HOURS. `coverage_id` is derived from the eligibility row —
 * callers can not shortcut it in the body.
 */
export async function handlePOST(args: {
  body: CreateVisitBody;
  ctx: OpdCtx;
  db?: any;
  now?: Date;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const now = args.now ?? new Date();
  const { body, ctx } = args;

  const { data: bene } = await db.from("beneficiary")
    .select("id, tenant_id, full_name, patient_file_no, contact_number, country_code, preferred_language, dob")
    .eq("id", body.beneficiary_id).maybeSingle();
  if (!bene || bene.tenant_id !== ctx.tenantId) return envelope("beneficiary not found", "not_found", 404);

  const { data: clinic } = await db.from("clinics")
    .select("id, tenant_id, name").eq("id", body.clinic_id).maybeSingle();
  if (!clinic || clinic.tenant_id !== ctx.tenantId) return envelope("clinic not found", "not_found", 404);

  // Look up newest visit_eligibility row for this beneficiary in the tenant.
  const { data: veRows } = await db.from("visit_eligibility")
    .select("id, status, financial_type, eligibility_type, checked_at, payer_id, policy_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("beneficiary_id", body.beneficiary_id)
    .order("checked_at", { ascending: false })
    .limit(1);
  const ve = (veRows ?? [])[0];
  if (!ve) return envelope("run eligibility-first before create-visit", "eligibility_stale", 409);

  const checkedMs = ve.checked_at ? new Date(ve.checked_at).getTime() : 0;
  if (!checkedMs || now.getTime() - checkedMs > STALE_HOURS * 3600 * 1000) {
    return envelope("eligibility check is stale", "eligibility_stale", 409, {
      checked_at: ve.checked_at, stale_hours: STALE_HOURS,
    });
  }

  if (ve.eligibility_type === "standard" && ve.status === "not_eligible") {
    return envelope("beneficiary not eligible", "not_eligible", 403);
  }

  // Insert encounter (AMB / open).
  const encInsert = {
    tenant_id: ctx.tenantId,
    beneficiary_id: body.beneficiary_id,
    class: "AMB",
    encounter_number: `E-${now.getTime().toString(36).toUpperCase()}`,
    status: "in-progress",
    journey_state: "encounter_open",
    period_start: now.toISOString(),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  };
  const { data: enc, error: eErr } = await db.from("encounter").insert(encInsert).select("id").maybeSingle();
  if (eErr || !enc) return envelope("database_error", "db_error", 500, { detail: eErr?.message });

  // Insert clinic_bookings row today, walk-in confirmed.
  const bkInsert = {
    tenant_id: ctx.tenantId,
    clinic_id: body.clinic_id,
    beneficiary_id: body.beneficiary_id,
    provider_id: body.provider_id ?? null,
    slot_at: now.toISOString(),
    status: "confirmed",
    source: "walk_in",
    kind: "in_person",
    origin_encounter_id: enc.id,
    charge_mode: "new_consult",
  };
  const { data: bk, error: bErr } = await db.from("clinic_bookings").insert(bkInsert).select("id").maybeSingle();
  if (bErr || !bk) return envelope("database_error", "db_error", 500, { detail: bErr?.message });

  // Token — literal counter derived from today's booking count for the clinic.
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const { data: sameDay } = await db.from("clinic_bookings")
    .select("id").eq("tenant_id", ctx.tenantId).eq("clinic_id", body.clinic_id)
    .gte("slot_at", dayStart.toISOString());
  const tokenNumber = String((sameDay?.length ?? 1)).padStart(3, "0");

  // Fire visit-confirmation SMS stub (interface_log).
  const mrn = (bene.patient_file_no as string | null) ?? bene.id.slice(0, 8);
  const phoneCountry = (bene.country_code as string | null) ?? "";
  const phoneRaw = (bene.contact_number as string | null) ?? "";
  const phoneE164 = phoneRaw ? `${phoneCountry}${phoneRaw}` : null;
  await sendVisitConfirmation({
    tenant_id: ctx.tenantId,
    phone_e164: phoneE164,
    lang: (bene.preferred_language === "ar" ? "ar" : "en") as "en" | "ar",
    mrn_masked: `***${mrn.slice(-4)}`,
    visit_at: bkInsert.slot_at,
    token_number: tokenNumber,
    clinic_name: clinic.name ?? "",
  }, db);

  return jsonData({
    ok: true,
    data: {
      encounter_id: enc.id,
      booking_id: bk.id,
      token_number: tokenNumber,
      clinic_id: body.clinic_id,
    },
    request_id: crypto.randomUUID(),
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/registration/create-visit")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "opd.registration.create_visit" });
      if (!auth.ok) return auth.res;
      let body: CreateVisitBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});