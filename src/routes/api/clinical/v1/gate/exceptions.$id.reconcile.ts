import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { reconcileEmergencyException } from "@/lib/rcm/emergency-reconcile";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Body = z.object({ nphies_approved_minor: z.number().int().nonnegative() });
const parse = parseBody((raw) => Body.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/gate/exceptions/$id/reconcile")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "gate.exception.reconcile" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("rcm_gate_exception", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const result = await reconcileEmergencyException(db, {
        exceptionId: params.id,
        nphiesApprovedMinor: parsed.data.nphies_approved_minor,
        actorId: auth.ctx.userId,
      });
      if (!("ok" in result) || !result.ok) {
        return envelope((result as any).message ?? "reconcile failed", (result as any).code ?? "reconcile_failed", 400);
      }
      if (result.already) {
        return jsonData({ data: { already_reconciled: true } }, 409);
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "gate.exception.reconcile", "rcm_gate_exception", params.id, result);
      return jsonData({ data: result });
    },
  } },
});