import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit, preflight, requireClinicalModule, serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, loadOwned } from "./_helpers";
import { EligibilityExceptionCreate } from "@/lib/mds/schema/rcm";
import { applyEvent } from "@/lib/rcm/eligibility-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
const parse = parseBody((raw) => EligibilityExceptionCreate.parse(raw));

/**
 * POST /api/clinical/v1/eligibility/:id/exception
 * Captures referral/emergency/newborn exception and transitions the
 * visit_eligibility into `exception_review`.
 */
export const Route = createFileRoute("/api/clinical/v1/eligibility/$id/exception")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "reg.eligibility" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("visit_eligibility", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data: exc, error } = await db.from("eligibility_exception").insert({
        tenant_id: auth.ctx.tenantId,
        visit_eligibility_id: params.id,
        ...parsed.data,
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      const moved = await applyEvent(params.id,
        { kind: "exception.raise", exception_type: parsed.data.exception_type },
        { userId: auth.ctx.userId, tenantId: auth.ctx.tenantId });
      if (!moved.ok) return envelope(moved.error, moved.code, moved.status ?? 409);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId,
        "eligibility.exception", "visit_eligibility", params.id, { type: parsed.data.exception_type });
      return jsonData({ data: { row: moved.row, exception: exc } }, 201);
    },
  } },
});