/**
 * Step 4 · Turn 3 — Treatment Room worklist (E16 touch-point).
 *
 * Reads `v_treatment_room_worklist` (join through charge_item.service_id
 * to service_master, filtered to execution_venue='treatment_room'; excludes
 * prescription_item order rows). Nothing performable until the billed-gate
 * trigger clears the row; this route is read-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";

export type OpdCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function handleGET(args: {
  query: { clinic_id?: string | null };
  ctx: OpdCtx;
  db?: any;
}): Promise<Response> {
  const db: any = args.db ?? serviceClient();
  let q = db.from("v_treatment_room_worklist").select("*").eq("tenant_id", args.ctx.tenantId);
  if (args.query.clinic_id) q = q.eq("clinic_id", args.query.clinic_id);
  const { data, error } = await q;
  if (error) return envelope("database_error", "db_error", 500);
  return jsonData({ ok: true, data: { rows: data ?? [] }, request_id: crypto.randomUUID() });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/treatment-room/worklist")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireClinicalModule(request, "Clinical", { capId: "opd.treatment_room.read" });
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        return handleGET({ query: { clinic_id: url.searchParams.get("clinic_id") }, ctx: auth.ctx });
      },
    },
  },
});