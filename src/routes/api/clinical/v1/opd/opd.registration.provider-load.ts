import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/clinical/v1/opd/registration/provider-load?clinic_id=…
 * Returns providers assigned to the clinic with their live in_queue_count
 * (bookings today with status ∈ requested|confirmed|arrived|in_consult).
 */

export type ProviderLoadCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

const ACTIVE_STATUSES = ["requested", "confirmed", "arrived", "in_consult"] as const;

export async function handleGET(args: {
  clinicId: string;
  ctx: ProviderLoadCtx;
  db?: any;
  now?: Date;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const now = args.now ?? new Date();
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const { data: clinic } = await db.from("clinics").select("id, tenant_id").eq("id", args.clinicId).maybeSingle();
  if (!clinic || clinic.tenant_id !== args.ctx.tenantId) return envelope("clinic not found", "not_found", 404);

  const { data: providers } = await db.from("providers")
    .select("id, full_name, specialty, clinic_id, tenant_id")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("clinic_id", args.clinicId);

  const list = (providers ?? []) as any[];
  if (list.length === 0) return jsonData({ ok: true, data: [] });

  const { data: bookings } = await db.from("clinic_bookings")
    .select("id, provider_id, status, slot_at")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("clinic_id", args.clinicId)
    .in("status", ACTIVE_STATUSES as unknown as string[])
    .gte("slot_at", dayStart.toISOString())
    .lt("slot_at", dayEnd.toISOString());

  const counts = new Map<string, number>();
  for (const b of (bookings ?? []) as any[]) {
    if (!b.provider_id) continue;
    counts.set(b.provider_id, (counts.get(b.provider_id) ?? 0) + 1);
  }

  const out = list.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    specialty: p.specialty,
    in_queue_count: counts.get(p.id) ?? 0,
  })).sort((a, b) => a.in_queue_count - b.in_queue_count);

  return jsonData({ ok: true, data: out });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/registration/provider-load")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "opd.registration" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const clinicId = url.searchParams.get("clinic_id");
      if (!clinicId) return envelope("clinic_id required", "bad_query", 400);
      return handleGET({ clinicId, ctx: auth.ctx });
    },
  } },
});