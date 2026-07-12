import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /api/clinical/v1/opd/registration/provider-load?clinic_id=…
 * Returns providers assigned to the clinic split into two counts per File 14 §③:
 *   booked_count   = today's bookings still off-site (requested|confirmed)
 *   in_queue_count = today's bookings on-site         (arrived|in_consult)
 * Kept as two distinct fields so the receptionist sees
 * "N booked · M in queue" instead of a single collapsed number.
 */

export type ProviderLoadCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

const BOOKED_STATUSES = ["requested", "confirmed"] as const;
const IN_QUEUE_STATUSES = ["arrived", "in_consult"] as const;
const ACTIVE_STATUSES = [...BOOKED_STATUSES, ...IN_QUEUE_STATUSES] as const;

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

  const booked = new Map<string, number>();
  const inQueue = new Map<string, number>();
  for (const b of (bookings ?? []) as any[]) {
    if (!b.provider_id) continue;
    if ((BOOKED_STATUSES as readonly string[]).includes(b.status)) {
      booked.set(b.provider_id, (booked.get(b.provider_id) ?? 0) + 1);
    } else if ((IN_QUEUE_STATUSES as readonly string[]).includes(b.status)) {
      inQueue.set(b.provider_id, (inQueue.get(b.provider_id) ?? 0) + 1);
    }
  }

  const out = list.map((p) => {
    const b = booked.get(p.id) ?? 0;
    const q = inQueue.get(p.id) ?? 0;
    return {
      id: p.id,
      full_name: p.full_name,
      specialty: p.specialty,
      booked_count: b,
      in_queue_count: q,
    };
  }).sort((a, b) => (a.booked_count + a.in_queue_count) - (b.booked_count + b.in_queue_count));

  return jsonData({ ok: true, data: out });
}

export const Route = createFileRoute("/api/clinical/v1/opd/registration/provider-load")({
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