import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handleGET(args: { query: { encounter_id: string }; ctx: OpdCtx; db?: any }): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { ctx, query } = args;
  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, journey_state").eq("id", query.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  let locked = false; let reason: string | null = null;
  const { data: bks } = await db.from("clinic_bookings")
    .select("status").eq("origin_encounter_id", enc.id).eq("status", "in_consult").limit(1);
  if (((bks as any[]) ?? []).length > 0) { locked = true; reason = "booking_in_consult"; }
  else if ((enc as any).journey_state === "clinically_documented") { locked = true; reason = "journey_clinically_documented"; }

  return jsonData({ ok: true, data: { locked, reason, journey_state: (enc as any).journey_state }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/cashier/consultation-lock")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Billing — OP/ER", { capId: "opd.cashier.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const encounter_id = url.searchParams.get("encounter_id");
      if (!encounter_id) return envelope("encounter_id required", "bad_body", 400);
      return handleGET({ query: { encounter_id }, ctx: auth.ctx });
    },
  } },
});