import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";
import { sendBundle } from "@/lib/mds/nphies/gateway";

/**
 * POST /prom-assignments/:id/submit — package PROM response as a NPHIES PRM
 * MDS bundle and forward via the shared Phase-9 gateway (sandbox-stubbed when
 * NPHIES_BASE_URL is unset). Every attempt is logged in nphies_message_log.
 */
export const Route = createFileRoute("/api/clinical/v1/prom-assignments/$id/submit")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["case_manager", "biller", "tenant_admin"]);
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data: a } = await db.from("prom_assignment")
          .select("*, prom_instrument(*), prom_response(*)")
          .eq("id", params.id).maybeSingle();
        if (!a || a.tenant_id !== auth.ctx.tenantId) return envelope("Not found", "not_found", 404);
        const responses = (a as unknown as { prom_response: Array<Record<string, unknown>> | Record<string, unknown> | null }).prom_response;
        const response = Array.isArray(responses) ? responses[0] : responses;
        if (!response) return envelope("No response captured", "no_response", 409);

        const idempotency = `prm-${params.id}`;
        const { data: logRow } = await db.from("nphies_message_log").insert({
          tenant_id: auth.ctx.tenantId,
          message_type: "prm-request",
          subject_table: "prom_assignment",
          subject_id: params.id,
          idempotency_key: idempotency,
          outcome: "in_flight",
          actor_id: auth.ctx.userId,
          sandbox: !process.env.NPHIES_BASE_URL,
        } as never).select("id").single();

        const bundle = buildPrmBundle(a, response);
        const result = await sendBundle(bundle, { idempotencyKey: idempotency, messageType: "prm-request", tenantId: auth.ctx.tenantId });

        if (logRow) {
          await db.from("nphies_message_log").update({
            outcome: result.ok ? "ok" : "error",
            http_status: result.http_status,
            request_body: bundle as unknown,
            response_body: (result.bundle ?? null) as unknown,
            error: result.error ?? null,
            sandbox: result.sandbox,
            finished_at: new Date().toISOString(),
          } as never).eq("id", (logRow as { id: string }).id);
        }

        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "prom_assignment.submit", "prom_assignment", params.id);
        return jsonData({ ok: result.ok, sandbox: result.sandbox, http_status: result.http_status, response: result.bundle });
      },
    },
  },
});

function buildPrmBundle(assignment: Record<string, unknown>, response: Record<string, unknown>): unknown {
  const inst = (assignment as { prom_instrument: Record<string, unknown> }).prom_instrument;
  return {
    resourceType: "Bundle",
    type: "message",
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: {
          resourceType: "MessageHeader",
          eventCoding: { system: "http://nphies.sa/CodeSystem/ksa-message-events", code: "prm-request" },
          source: { name: "VeloMed OS" },
        },
      },
      {
        resource: {
          resourceType: "QuestionnaireResponse",
          status: "completed",
          questionnaire: `Questionnaire/${(inst as { key: string }).key}|${(inst as { version: string }).version}`,
          authored: response.collected_at,
          item: Object.entries((response.answers ?? {}) as Record<string, number>).map(([k, v]) => ({
            linkId: k,
            answer: [{ valueDecimal: v }],
          })),
          extension: [
            {
              url: "http://nphies.sa/StructureDefinition/prm-score",
              valueCodeableConcept: { text: JSON.stringify(response.score ?? {}) },
            },
          ],
        },
      },
    ],
  };
}