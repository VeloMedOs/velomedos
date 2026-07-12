/**
 * Step 4 · Turn 4 — Resolve and read the applicable maternity protocol
 * for an encounter (D2 hyperlink target). 404 when no match.
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

  const { data: pid } = await db.rpc("resolve_maternity_protocol", {
    _tenant: args.ctx.tenantId, _encounter: encId,
  });
  if (!pid) return envelope("no protocol for encounter", "not_found", 404);

  const { data: mp } = await db.from("maternity_protocol")
    .select("id, name, rules").eq("id", pid).maybeSingle();
  if (!mp) return envelope("protocol row missing", "not_found", 404);

  return jsonData({
    ok: true,
    data: { protocol_id: (mp as any).id, name: (mp as any).name ?? null, rules: (mp as any).rules ?? null },
    request_id: crypto.randomUUID(),
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/maternity/protocol")({
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