import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CreateSchema = z.object({
  charge_item_id: z.string().uuid().nullish(),
  encounter_id: z.string().uuid().nullish(),
  admission_request_id: z.string().uuid().nullish(),
  exception_type: z.string(),
  reason_code: z.string().nullish(),
  reason_text: z.string().max(2000).nullish(),
  manual_approved_minor: z.number().int().nonnegative().nullish(),
  expires_at: z.string().datetime().nullish(),
});
const parseCreate = parseBody((raw) => CreateSchema.parse(raw));

/**
 * GET /api/clinical/v1/gate/exceptions   — list (filter: status=open|closed, encounter_id)
 * POST /api/clinical/v1/gate/exceptions  — create (cap: gate.exception.create)
 */
export const Route = createFileRoute("/api/clinical/v1/gate/exceptions")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "gate.exception.read" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status"); // open | closed
      const encounterId = url.searchParams.get("encounter_id");
      const db = serviceClient() as any;
      let q = db.from("rcm_gate_exception").select("*").eq("tenant_id", auth.ctx.tenantId).order("created_at", { ascending: false });
      if (status === "open") q = q.is("closed_at", null);
      if (status === "closed") q = q.not("closed_at", "is", null);
      if (encounterId) q = q.eq("encounter_id", encounterId);
      const { data, error } = await q.limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "gate.exception.create" });
      if (!auth.ok) return auth.res;
      const parsed = await parseCreate(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("rcm_gate_exception").insert({
        tenant_id: auth.ctx.tenantId,
        ...parsed.data,
        granted_by: auth.ctx.userId,
        granted_role: auth.ctx.clinicalRole,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "gate.exception.create", "rcm_gate_exception", data.id, parsed.data);
      return jsonData({ data }, 201);
    },
  } },
});