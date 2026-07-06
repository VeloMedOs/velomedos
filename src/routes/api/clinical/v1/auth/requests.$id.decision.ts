import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { canTransition, statusForDecision, type AuthStatus } from "@/lib/rcm/auth-sm";
import { reconcileEmergencyException } from "@/lib/rcm/emergency-reconcile";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DecisionBody = z.object({
  decision: z.enum(["approve", "partial", "reject"]),
  reason: z.string().trim().nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  items: z.array(z.object({
    id: z.string().uuid(),
    decision: z.enum(["approved", "partial", "rejected"]).optional(),
    approved_quantity: z.number().min(0).nullable().optional(),
    benefit_amount_minor: z.number().int().nullable().optional(),
    reason: z.string().nullable().optional(),
  })).optional(),
});

export const Route = createFileRoute("/api/clinical/v1/auth/requests/$id/decision")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Authorization", { capId: "auth.decide" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => DecisionBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const owned = await loadOwned<any>("authorization_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const next = statusForDecision(parsed.data.decision);
      if (!canTransition(owned.row.status as AuthStatus, next)) {
        return envelope(`Illegal transition ${owned.row.status} → ${next}`, "invalid_state", 409);
      }
      const db = serviceClient() as any;
      const { data, error } = await db.from("authorization_request").update({
        status: next,
        decision_at: new Date().toISOString(),
        decision_reason: parsed.data.reason ?? null,
        valid_from: parsed.data.valid_from ?? owned.row.valid_from,
        valid_to: parsed.data.valid_to ?? owned.row.valid_to,
        updated_by: auth.ctx.userId,
      }).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      for (const it of parsed.data.items ?? []) {
        await db.from("authorization_item").update({
          decision: it.decision ?? (parsed.data.decision === "approve" ? "approved"
            : parsed.data.decision === "partial" ? "partial" : "rejected"),
          approved_quantity: it.approved_quantity ?? null,
          benefit_amount_minor: it.benefit_amount_minor ?? null,
          reason: it.reason ?? null,
          updated_by: auth.ctx.userId,
        }).eq("id", it.id).eq("authorization_request_id", params.id);
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "auth_request.decision",
        "authorization_request", params.id, { decision: parsed.data.decision });

      // B1 · Auto-reconcile emergency_override exceptions on this encounter.
      // Never let a reconcile failure fail the decision write — the manual
      // endpoint (POST /gate/exceptions/$id/reconcile) is the recovery path.
      try {
        const encounterId = (data as any)?.encounter_id ?? (owned.row as any)?.encounter_id ?? null;
        if (encounterId && parsed.data.decision !== "reject") {
          const { data: items } = await db.from("authorization_item").select("benefit_amount_minor")
            .eq("authorization_request_id", params.id);
          const approvedMinor = (items ?? []).reduce(
            (s: number, r: any) => s + (Number(r.benefit_amount_minor) || 0), 0);
          const { data: excs } = await db.from("rcm_gate_exception")
            .select("id")
            .eq("tenant_id", auth.ctx.tenantId)
            .eq("encounter_id", encounterId)
            .eq("exception_type", "emergency_override")
            .is("closed_at", null)
            .is("reconciled_at", null);
          for (const exc of (excs ?? []) as Array<{ id: string }>) {
            await reconcileEmergencyException(db, {
              exceptionId: exc.id,
              nphiesApprovedMinor: approvedMinor,
              actorId: auth.ctx.userId,
            });
          }
        }
      } catch (err) {
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "auth_request.reconcile_failed",
          "authorization_request", params.id, { error: (err as Error)?.message ?? String(err) });
      }

      return jsonData({ data });
    },
  } },
});