import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Body = z.object({
  booking_id: z.string().uuid(),
  target_clinic_id: z.string().uuid(),
  required_specialty: z.string().min(1),
  reason: z.string().optional(),
});
export type RouteBody = z.infer<typeof Body>;
export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handlePOST(args: { body: RouteBody; ctx: OpdCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { body, ctx } = args;

  const { data: bk } = await db.from("clinic_bookings")
    .select("id, tenant_id, clinic_id, status, origin_encounter_id, beneficiary_id")
    .eq("id", body.booking_id).maybeSingle();
  if (!bk || bk.tenant_id !== ctx.tenantId) return envelope("booking not found", "not_found", 404);

  const { data: clinic } = await db.from("clinics")
    .select("id, tenant_id, specialties, name").eq("id", body.target_clinic_id).maybeSingle();
  if (!clinic) return envelope("clinic not found", "not_found", 404);
  const specs: string[] = Array.isArray((clinic as any).specialties) ? (clinic as any).specialties : [];
  if (!specs.includes(body.required_specialty)) {
    return envelope("target clinic does not offer the required specialty", "specialty_mismatch", 422, {
      required_specialty: body.required_specialty, clinic_specialties: specs,
    });
  }

  const { data: upd, error } = await db.from("clinic_bookings")
    .update({ clinic_id: body.target_clinic_id }).eq("id", bk.id).select("*").single();
  if (error) return envelope(error.message, "db_error", 400);

  await db.from("booking_event").insert({
    tenant_id: ctx.tenantId, booking_id: bk.id, event: "routed", by_user: ctx.userId,
    payload: { from_clinic_id: bk.clinic_id, to_clinic_id: body.target_clinic_id, reason: body.reason ?? null },
  });

  return jsonData({ ok: true, data: { booking: upd }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/routing")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.routing.write" });
      if (!auth.ok) return auth.res;
      let body: RouteBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});