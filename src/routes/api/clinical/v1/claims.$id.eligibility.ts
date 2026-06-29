import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "./_helpers";
import { buildEligibilityBundle } from "@/lib/mds/fhir/eligibility";
import { submitEligibility } from "@/lib/mds/nphies/gateway";
import { parseEligibility } from "@/lib/mds/fhir/claim-response";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * POST /api/clinical/v1/claims/:id/eligibility
 *
 * Phase 9 — fires a CoverageEligibilityRequest at NPHIES and caches the
 * outcome on the claim row (eligibility_response + eligibility_checked_at).
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/eligibility")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, [
          "biller", "case_manager", "registrar",
        ]);
        if (!auth.ok) return auth.res;

        const owned = await loadOwned<{ tenant_id: string; coverage_id: string | null }>(
          "claim", params.id, auth.ctx.tenantId, "id, tenant_id, coverage_id",
        );
        if (!owned.ok) return owned.res;
        if (!owned.row.coverage_id) {
          return envelope("Claim has no coverage attached", "no_coverage", 400);
        }

        let bundle: any;
        try {
          bundle = await buildEligibilityBundle(params.id);
        } catch (e: any) {
          return envelope(e?.message ?? "bundle_error", "bundle_error", 500);
        }

        const idem = await sha256Hex(`elig:${params.id}:${Date.now()}`);
        const result = await submitEligibility(bundle, idem);
        if (!result.ok) {
          return envelope(result.error ?? "Gateway error", "gateway_error", 502, {
            sandbox: result.sandbox,
          });
        }

        const parsed = parseEligibility(result.bundle);
        const db = serviceClient() as any;
        await db.from("claim").update({
          eligibility_response: result.bundle,
          eligibility_checked_at: new Date().toISOString(),
        }).eq("id", params.id);

        await clinicalAudit(
          auth.ctx.userId, auth.ctx.tenantId,
          "claim.eligibility", "claim", params.id,
          { sandbox: result.sandbox, inforce: parsed.inforce },
        );

        return jsonData({
          data: parsed,
          sandbox: result.sandbox,
        });
      },
    },
  },
});