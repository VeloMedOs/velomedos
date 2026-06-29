/**
 * ZATCA Phase-2 sandbox stub. Deterministic JSON, no network.
 */
import { logInterface } from "@/lib/interface-log";

export type ZatcaInvoiceInput = {
  tenantId: string;
  invoiceId: string;
  totalSar: number;
  vatSar: number;
  buyerName?: string | null;
  sellerName?: string;
  issuedAt?: string;
};

export type ZatcaInvoiceResult = {
  ok: true;
  sandbox: true;
  uuid: string;
  hash: string;
  qr_base64: string;
  cleared_at: string;
};

function b64(s: string): string {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(s)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).Buffer.from(s, "utf-8").toString("base64");
}

export async function submitB2CInvoice(input: ZatcaInvoiceInput): Promise<ZatcaInvoiceResult> {
  const issued = input.issuedAt ?? new Date().toISOString();
  const qrPayload = [
    input.sellerName ?? "VeloMed Demo Hospital",
    input.tenantId.slice(0, 8),
    issued,
    input.totalSar.toFixed(2),
    input.vatSar.toFixed(2),
  ].join("|");
  const result: ZatcaInvoiceResult = {
    ok: true,
    sandbox: true,
    uuid: crypto.randomUUID(),
    hash: b64(`zatca:${input.invoiceId}:${input.totalSar}`).slice(0, 44),
    qr_base64: b64(qrPayload),
    cleared_at: issued,
  };
  await logInterface({
    tenantId: input.tenantId,
    messageType: "zatca.b2c.submit",
    subjectTable: "tax_invoice",
    subjectId: input.invoiceId,
    idempotencyKey: `zatca-${input.invoiceId}`,
    sandbox: true,
    outcome: "ok",
    requestBody: input,
    responseBody: result,
  });
  return result;
}