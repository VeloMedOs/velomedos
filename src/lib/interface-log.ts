/**
 * Lightweight wrapper around `nphies_message_log` so non-NPHIES gateway
 * stubs (ZATCA, D365, POS) can populate the Interface Monitoring screen
 * with deterministic sandbox events. Never throws — logging is best-effort.
 */
import { serviceClient } from "@/lib/api-server";

export type InterfaceLogInput = {
  tenantId: string;
  messageType: string;
  subjectTable?: string | null;
  subjectId?: string | null;
  idempotencyKey: string;
  sandbox?: boolean;
  httpStatus?: number | null;
  outcome: "in_flight" | "ok" | "error";
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string | null;
  actorId?: string | null;
};

export async function logInterface(input: InterfaceLogInput): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient() as any).from("nphies_message_log").insert({
      tenant_id: input.tenantId,
      message_type: input.messageType,
      subject_table: input.subjectTable ?? null,
      subject_id: input.subjectId ?? null,
      idempotency_key: input.idempotencyKey,
      sandbox: input.sandbox ?? true,
      http_status: input.httpStatus ?? 200,
      outcome: input.outcome,
      request_body: input.requestBody ?? null,
      response_body: input.responseBody ?? null,
      error: input.error ?? null,
      actor_id: input.actorId ?? null,
      finished_at: new Date().toISOString(),
    });
  } catch {
    /* noop — never break the request path */
  }
}