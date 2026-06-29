import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  serviceClient,
} from "@/lib/api-clinical";
import { ClaimSubmitRequest } from "@/lib/mds/schema/claims";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";
import { buildClaimBundle } from "@/lib/mds/fhir/claim";
import { submitClaim } from "@/lib/mds/nphies/gateway";
import { parseClaimResponse } from "@/lib/mds/fhir/claim-response";
import { reconcileClaim } from "@/lib/mds/claim-reconcile";

/* eslint-disable @typescript-eslint/no-explicit-any */

const parse = parseBody((raw) => ClaimSubmitRequest.parse(raw ?? {}));

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * POST /api/clinical/v1/claims/:id/submit
 *
 * Phase 9 — real NPHIES submission (sandbox-fallback when env not set):
 *  1. Single-flight via `claim_submission_attempt` unique partial index.
 *  2. Idempotency key from header `Idempotency-Key` or sha256(id+updated_at).
 *  3. Builds FHIR Bundle, posts to gateway, parses ClaimResponse, reconciles
 *     payer/patient shares back to claim_item, transitions claim status.
 */
export const Route = createFileRoute("/api/clinical/v1/claims/$id/submit")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["biller", "case_manager"]);
        if (!auth.ok) return auth.res;

        const owned = await loadOwned<{ tenant_id: string; status: string; updated_at: string }>(
          "claim",
          params.id,
          auth.ctx.tenantId,
          "id, tenant_id, status, updated_at",
        );
        if (!owned.ok) return owned.res;
        if (!["draft", "ready", "rejected"].includes(owned.row.status)) {
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

        const idemHeader = request.headers.get("idempotency-key");
        const idempotencyKey =
          idemHeader?.trim() ||
          (await sha256Hex(`${params.id}:${owned.row.updated_at}`));

        // Compute next attempt_no (advisory; the unique partial index on
        // outcome='in_flight' is the actual single-flight guard).
        const { data: lastAttempts } = await db
          .from("claim_submission_attempt")
          .select("attempt_no")
          .eq("claim_id", params.id)
          .order("attempt_no", { ascending: false })
          .limit(1);
        const nextAttemptNo = ((lastAttempts?.[0]?.attempt_no ?? 0) as number) + 1;

        // Single-flight insert. Unique partial index rejects an in-flight attempt.
        const { data: attempt, error: attErr } = await db
          .from("claim_submission_attempt")
          .insert({
            claim_id: params.id,
            tenant_id: auth.ctx.tenantId,
            attempt_no: nextAttemptNo,
            idempotency_key: idempotencyKey,
            outcome: "in_flight",
            actor_id: auth.ctx.userId,
          })
          .select("*")
          .single();
        if (attErr) {
          return envelope(
            "A submission attempt is already in flight for this claim",
            "submission_in_flight",
            409,
            { detail: attErr.message },
          );
        }

        let bundle: any;
        try {
          bundle = await buildClaimBundle(params.id);
        } catch (e: any) {
          await db.from("claim_submission_attempt").update({
            outcome: "error", finished_at: new Date().toISOString(),
            error: e?.message ?? "bundle_build_failed",
          }).eq("id", attempt.id);
          return envelope(e?.message ?? "Bundle build failed", "bundle_error", 500);
        }

        const result = await submitClaim(bundle, idempotencyKey);

        // Persist request/response snapshots
        await db.from("claim_submission_attempt").update({
          outcome: result.ok ? "ok" : "error",
          finished_at: new Date().toISOString(),
          http_status: result.http_status,
          sandbox: result.sandbox,
          request_body: bundle,
          response_body: result.bundle,
          error: result.ok ? null : result.error ?? "gateway_error",
        }).eq("id", attempt.id);

        if (!result.ok) {
          return envelope(result.error ?? "Gateway error", "gateway_error", 502, {
            attempt_id: attempt.id,
            sandbox: result.sandbox,
          });
        }

        const parsedResp = parseClaimResponse(result.bundle);
        const reconciled = await reconcileClaim(db, params.id, parsedResp);

        // Map adjudication outcome onto the existing claim.status enum
        // (draft|ready|submitted|accepted|rejected). Granular outcome is
        // captured separately on claim.adjudication_outcome.
        const newStatus =
          parsedResp.outcome === "error" ? "rejected" : "accepted";

        const { data, error } = await db
          .from("claim")
          .update({
            status: newStatus,
            submitted_at: now,
            adjudicated_at: new Date().toISOString(),
            adjudication_outcome: reconciled.outcome,
            nphies_claim_id: parsedResp.nphiesClaimId,
            nphies_request: bundle,
            nphies_response: result.bundle,
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
          {
            sandbox: result.sandbox,
            outcome: reconciled.outcome,
            nphies_claim_id: parsedResp.nphiesClaimId,
            mismatches: reconciled.mismatches.length,
          },
        );

        return jsonData({
          data,
          attempt_id: attempt.id,
          sandbox: result.sandbox,
          reconciliation: reconciled,
          errors: parsedResp.errors,
        });
      },
    },
  },
});