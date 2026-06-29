/** POS (point-of-sale) sandbox stub for the cashier flow. */
import { logInterface } from "@/lib/interface-log";

export type PosChargeInput = {
  tenantId: string;
  receiptRef: string;
  amountSar: number;
  method: "card" | "cash" | "wallet" | "transfer";
};

export type PosChargeResult = {
  ok: true;
  sandbox: true;
  terminal_id: string;
  approval_code: string;
  captured_at: string;
};

export async function chargeReceipt(input: PosChargeInput): Promise<PosChargeResult> {
  // Deterministic approval code keyed off receipt ref to keep the demo stable.
  const approvalSeed = Array.from(input.receiptRef).reduce((a, c) => a + c.charCodeAt(0), 0);
  const result: PosChargeResult = {
    ok: true,
    sandbox: true,
    terminal_id: `POS-DEMO-${input.tenantId.slice(0, 4).toUpperCase()}`,
    approval_code: `AP${String(100000 + (approvalSeed % 899999)).padStart(6, "0")}`,
    captured_at: new Date().toISOString(),
  };
  await logInterface({
    tenantId: input.tenantId,
    messageType: `pos.${input.method}.capture`,
    subjectTable: "portal_payments",
    subjectId: input.receiptRef,
    idempotencyKey: `pos-${input.receiptRef}`,
    sandbox: true,
    outcome: "ok",
    requestBody: input,
    responseBody: result,
  });
  return result;
}