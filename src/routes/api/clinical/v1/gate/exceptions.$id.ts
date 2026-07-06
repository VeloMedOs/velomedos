import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PatchSchema = z.object({
  reason_text: z.string().max(2000).nullish(),
  expires_at: z.string().datetime().nullish(),
  closed_at: z.string().datetime().nullish(),
  retrospective_auth_state: z.string().nullish(),
});
const parsePatch = parseBody((raw) => PatchSchema.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/gate/exceptions/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "gate.exception.update" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("rcm_gate_exception", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parsePatch(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const patch: Record<string, unknown> = { ...parsed.data };
      if (patch.closed_at) patch.closed_by = auth.ctx.userId;
      const { data, error } = await db.from("rcm_gate_exception").update(patch).eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "gate.exception.update", "rcm_gate_exception", params.id, patch);
      return jsonData({ data });
    },
  } },
});