import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Manual create/edit of remittance lines. The matching engine on the
 * remittance `action` route handles auto-matching; this route is used by
 * finance officers to type ERA lines or override a mismatch → manual.
 */
const CreateLine = z.object({
  remittance_id: z.string().uuid(),
  claim_id: z.string().uuid().optional(),
  claim_sequence_no: z.string().max(64).optional(),
  bill_ref: z.string().max(64).optional(),
  paid_amount_minor: z.number().int().nonnegative(),
  allocated_amount_minor: z.number().int().nonnegative().default(0),
  adjustment_minor: z.number().int().default(0),
  reason_code: z.string().max(64).optional(),
  notes: z.string().max(1000).optional(),
  match_status: z.enum(["unmatched","matched","mismatch","manual"]).default("unmatched"),
});

export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/remittance-lines")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.post" });
      if (!auth.ok) return auth.res;
      const body = await parseBody((raw) => CreateLine.parse(raw))(request);
      if (!body.ok) return body.res;
      const db = serviceClient() as any;
      const { data: r } = await db.from("remittance").select("tenant_id, status").eq("id", body.data.remittance_id).maybeSingle();
      if (!r || r.tenant_id !== auth.ctx.tenantId) return envelope("not_found", "not_found", 404);
      if (r.status === "posted" || r.status === "closed") return envelope(`Remittance is ${r.status}`, "invalid_state", 409);
      const ins = await db.from("remittance_line").insert({
        tenant_id: auth.ctx.tenantId,
        ...body.data,
      }).select("*").single();
      if (ins.error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: ins.data }, 201);
    },
  } },
});