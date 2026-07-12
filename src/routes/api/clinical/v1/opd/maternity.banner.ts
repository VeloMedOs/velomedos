/**
 * Step 4 · Turn 4 — Maternity banner readout (HCA-0240 D2/D4/D6).
 *
 * Combines the active-pregnancy episode view, the payer protocol resolver,
 * and a view-only list of prior encounters sharing this pregnancy episode
 * (no cross-tenant queries). Read-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handleGET(args: {
  query: { encounter_id: string | null };
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const encId = args.query.encounter_id;
  if (!encId) return envelope("encounter_id required", "invalid_input", 400);

  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id, episode_of_care_id, period_start")
    .eq("id", encId).maybeSingle();
  if (!enc || enc.tenant_id !== args.ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  const { data: episode } = await db.from("v_pregnancy_episode_active")
    .select("episode_id, start_date, edd_computed, weeks_gestation, cadence_band")
    .eq("tenant_id", args.ctx.tenantId)
    .eq("beneficiary_id", enc.beneficiary_id)
    .maybeSingle();

  const pregnancy_active = !!episode;
  let next_anc_suggested_at: string | null = null;
  if (episode?.cadence_band) {
    const days = episode.cadence_band === "Q1W" ? 7 : episode.cadence_band === "Q2W" ? 14 : 28;
    const d = new Date(); d.setDate(d.getDate() + days);
    next_anc_suggested_at = d.toISOString();
  }

  const { data: protocolId } = await db.rpc("resolve_maternity_protocol", {
    _tenant: args.ctx.tenantId, _encounter: encId,
  });

  let protocol_summary: string | null = null;
  if (protocolId) {
    const { data: mp } = await db.from("maternity_protocol")
      .select("name").eq("id", protocolId).maybeSingle();
    protocol_summary = (mp as any)?.name ?? null;
  }

  let cross_facility_visits: Array<{ encounter_id: string; period_start: string | null; facility: string | null }> = [];
  if (enc.episode_of_care_id) {
    const { data: siblings } = await db.from("encounter")
      .select("id, period_start")
      .eq("tenant_id", args.ctx.tenantId)
      .eq("episode_of_care_id", enc.episode_of_care_id)
      .neq("id", encId)
      .order("period_start", { ascending: false })
      .limit(20);
    cross_facility_visits = ((siblings ?? []) as any[]).map((r) => ({
      encounter_id: r.id, period_start: r.period_start, facility: null,
    }));
  }

  return jsonData({
    ok: true,
    data: {
      pregnancy_active,
      edd_computed: (episode as any)?.edd_computed ?? null,
      weeks_gestation: (episode as any)?.weeks_gestation ?? null,
      cadence_band: (episode as any)?.cadence_band ?? null,
      next_anc_suggested_at,
      protocol_id: protocolId ?? null,
      protocol_summary,
      cross_facility_visits,
    },
    request_id: crypto.randomUUID(),
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/maternity/banner")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.maternity.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      return handleGET({ query: { encounter_id: url.searchParams.get("encounter_id") }, ctx: auth.ctx });
    },
  } },
});