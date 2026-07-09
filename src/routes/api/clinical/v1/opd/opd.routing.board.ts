import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handleGET(args: {
  query: { specialty?: string | null }; ctx: OpdCtx; db?: any; now?: Date;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { ctx } = args;
  const now = args.now ?? new Date();

  const { data: initial } = await db.from("queue_occupancy").select("*").eq("tenant_id", ctx.tenantId);
  const rows: any[] = (initial as any[]) ?? [];
  const oldest = rows
    .map((r: any) => (r.refreshed_at ? new Date(r.refreshed_at).getTime() : 0))
    .reduce((a: number, b: number) => Math.min(a, b), Number.MAX_SAFE_INTEGER);
  const stale = rows.length === 0 || (now.getTime() - oldest) > 3 * 60 * 1000;
  let refreshed = rows;
  if (stale) {
    await db.rpc("refresh_queue_occupancy", { _tenant: ctx.tenantId });
    const { data: next } = await db.from("queue_occupancy").select("*").eq("tenant_id", ctx.tenantId);
    refreshed = (next as any[]) ?? rows;
  }

  const clinicIds = Array.from(new Set(refreshed.map((r: any) => r.clinic_id).filter(Boolean)));
  let clinics: any[] = [];
  if (clinicIds.length) {
    const { data: cs } = await db.from("clinics").select("id, name, specialties").in("id", clinicIds);
    clinics = (cs as any[]) ?? [];
  }
  const byId = new Map(clinics.map((c: any) => [c.id, c]));
  const out = refreshed.map((r: any) => ({
    ...r,
    clinic_name: byId.get(r.clinic_id)?.name ?? null,
    clinic_specialties: byId.get(r.clinic_id)?.specialties ?? [],
  }));

  return jsonData({ ok: true, data: { rows: out, refreshed_now: stale }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/routing/board")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.routing.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      return handleGET({ query: { specialty: url.searchParams.get("specialty") }, ctx: auth.ctx });
    },
  } },
});