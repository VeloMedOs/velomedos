import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  serviceClient,
} from "@/lib/api-clinical";
import { ClaimSubmitRequest } from "@/lib/mds/schema/claims";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parse = parseBody((raw) => ClaimSubmitRequest.parse(raw ?? {}));

/**
 * POST /api/clinical/v1/claims/:id/submit
 *
 * Phase 7 stub for NPHIES submission. Marks the claim as `submitted`,
 * stamps submitted_at, and stores a stub envelope in nphies_response.
 * Phase 9 replaces the body with the real NPHIES gateway call.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/submit")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["biller", "case_manager"]);
        if (!auth.ok) return auth.res;

        const owned = await loadOwned<{ tenant_id: string; status: string }>(
          "claim",
          params.id,
          auth.ctx.tenantId,
          "id, tenant_id, status",
        );
        if (!owned.ok) return owned.res;
        if (!["draft", "ready"].includes(owned.row.status)) {
          return envelope(
            `Claim cannot be submitted from status ${owned.row.status}`,
            "bad_status",
            409,
          );
        }

        const parsed = await parse(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient() as any;
        const now = new Date().toISOString();
        const { data, error } = await db
          .from("claim")
          .update({
            status: "submitted",
            submitted_at: now,
            nphies_response: {
              stub: true,
              note: parsed.data.note ?? null,
              submitted_by: auth.ctx.userId,
              submitted_at: now,
            },
            updated_by: auth.ctx.userId,
          })
          .eq("id", params.id)
          .select("*")
          .single();
        if (error) return envelope(error.message, "db_error", 400);

        await clinicalAudit(
          auth.ctx.userId,
          auth.ctx.tenantId,
          "claim.submit",
          "claim",
          params.id,
          { stub: true },
        );
        return jsonData({ data });
      },
    },
  },
});