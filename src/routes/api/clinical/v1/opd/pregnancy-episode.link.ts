import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

const Body = z.object({
  encounter_id: z.string().uuid(),
  /** Caller passes the clinic specialty; if omitted we treat as non-OBS and skip. */
  specialty: z.string().nullable().optional(),
});
export type PregnancyLinkBody = z.infer<typeof Body>;

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

function isObsGyn(spec: string | null | undefined): boolean {
  if (!spec) return false;
  const s = spec.toLowerCase();
  return s.includes("obs") || s.includes("gyn") || s === "obgyn" || s === "obs_gyn";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HCA-0240 · JJ2 — link the encounter to the beneficiary's active
 * pregnancy `episode_of_care` when the visit is an OBS&GYN one.
 * Idempotent (no-op if `encounter.episode_of_care_id` already set).
 */
export async function handlePOST(args: {
  body: PregnancyLinkBody;
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  const { body, ctx } = args;

  const { data: enc } = await db.from("encounter")
    .select("id, tenant_id, beneficiary_id, episode_of_care_id")
    .eq("id", body.encounter_id).maybeSingle();
  if (!enc || enc.tenant_id !== ctx.tenantId) return envelope("encounter not found", "not_found", 404);

  if (enc.episode_of_care_id) {
    return jsonData({ ok: true, data: { linked: false, reason: "already_linked" }, request_id: crypto.randomUUID() });
  }

  if (!isObsGyn(body.specialty ?? null)) {
    return jsonData({ ok: true, data: { linked: false, reason: "non_obs_specialty" }, request_id: crypto.randomUUID() });
  }

  const { data: episode } = await db.from("episode_of_care")
    .select("id, tenant_id, care_type, status, end_date")
    .eq("beneficiary_id", enc.beneficiary_id)
    .eq("care_type", "pregnancy")
    .eq("status", "active")
    .maybeSingle();
  if (!episode || episode.tenant_id !== ctx.tenantId) {
    return jsonData({ ok: true, data: { linked: false, reason: "no_active_pregnancy" }, request_id: crypto.randomUUID() });
  }

  const { error: uErr } = await db.from("encounter")
    .update({ episode_of_care_id: episode.id })
    .eq("id", enc.id);
  if (uErr) return envelope("database_error", "db_error", 500, { detail: uErr.message });

  return jsonData({
    ok: true,
    data: { linked: true, episode_of_care_id: episode.id, end_date: episode.end_date },
    request_id: crypto.randomUUID(),
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/pregnancy-episode/link")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.pregnancy_episode" });
      if (!auth.ok) return auth.res;
      let body: PregnancyLinkBody;
      try { body = Body.parse(await request.json()); }
      catch (e) { return envelope("Bad body", "bad_body", 400, { detail: (e as Error).message }); }
      return handlePOST({ body, ctx: auth.ctx });
    },
  } },
});