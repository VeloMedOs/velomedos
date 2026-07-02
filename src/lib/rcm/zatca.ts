/**
 * R7 · ZATCA Phase-2 e-invoice builder (stub-until-creds).
 *
 * Emits a deterministic ZATCA-shaped payload:
 *   - UUID (per invoice; server persists in tax_invoice.zatca_uuid)
 *   - Hash chain: sha256(prev_hash || canonical_invoice_json)
 *   - TLV QR (Base64) for B2C simplified invoices — seller name, VAT no,
 *     ISO timestamp, total, VAT
 *   - Signed-XML skeleton (UBL 2.1-ish; signing left to the ZATCA gateway)
 *
 * B2B = standard (must be `cleared`). B2C = simplified (must be `reported`).
 * Credit / debit notes carry `parent_invoice_id` and reverse totals.
 *
 * All crypto runs in the Worker runtime (WebCrypto via Node/Deno globals);
 * `subtle` is used lazily inside the async builder to keep this module
 * import-safe from client code.
 */
import { computeInvoice, type LineIn, type InvoiceRollup } from "./vat-engine";

export type ZatcaChannel = "cleared" | "reported";

export type ZatcaInvoiceInput = {
  invoice_uuid: string;
  invoice_no: string;
  invoice_type: "b2b_insurance" | "b2c_patient" | "direct_company" | "credit_note" | "debit_note";
  issued_at: string;                     // ISO
  seller: { name: string; vat_no: string; crn?: string };
  buyer:  { name?: string; vat_no?: string; national_id?: string };
  lines:  LineIn[];
  prev_hash?: string | null;             // per-tenant per-stream chain
  currency?: string;
  parent_invoice_ref?: string | null;    // for CN/DN
};

export type ZatcaInvoiceOutput = {
  channel: ZatcaChannel;
  invoice_uuid: string;
  invoice_no: string;
  rollup: InvoiceRollup;
  hash: string;
  prev_hash: string | null;
  qr_tlv_base64: string;
  signed_xml: string;
  submitted_payload: Record<string, unknown>;
};

function tlv(tag: number, value: string): Uint8Array {
  const enc = new TextEncoder();
  const v = enc.encode(value);
  const out = new Uint8Array(2 + v.length);
  out[0] = tag; out[1] = v.length;
  out.set(v, 2);
  return out;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  // eslint-disable-next-line no-undef
  return (typeof btoa !== "undefined" ? btoa(s) : Buffer.from(s, "binary").toString("base64"));
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  // Prefer WebCrypto (Cloudflare Worker + modern Node)
  const g: any = globalThis as any;
  const digest = await g.crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Build the ZATCA TLV QR (5 mandatory tags for Phase-2 simplified). */
function buildQr(input: ZatcaInvoiceInput, rollup: InvoiceRollup): string {
  const parts: Uint8Array[] = [
    tlv(1, input.seller.name),
    tlv(2, input.seller.vat_no),
    tlv(3, new Date(input.issued_at).toISOString()),
    tlv(4, (rollup.total_minor / 100).toFixed(2)),
    tlv(5, (rollup.vat_minor / 100).toFixed(2)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const packed = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { packed.set(p, off); off += p.length; }
  return b64(packed);
}

function chooseChannel(t: ZatcaInvoiceInput["invoice_type"]): ZatcaChannel {
  if (t === "b2c_patient") return "reported";
  return "cleared";
}

function buildSignedXml(input: ZatcaInvoiceInput, rollup: InvoiceRollup, hash: string): string {
  // Placeholder UBL-ish skeleton. Real signing happens on the ZATCA gateway.
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">`,
    `  <ID>${input.invoice_no}</ID>`,
    `  <UUID>${input.invoice_uuid}</UUID>`,
    `  <IssueDate>${input.issued_at.slice(0,10)}</IssueDate>`,
    `  <InvoiceTypeCode>${input.invoice_type}</InvoiceTypeCode>`,
    `  <DocumentCurrencyCode>${input.currency ?? "SAR"}</DocumentCurrencyCode>`,
    `  <AccountingSupplierParty><Name>${input.seller.name}</Name><VAT>${input.seller.vat_no}</VAT></AccountingSupplierParty>`,
    `  <AccountingCustomerParty><Name>${input.buyer.name ?? ""}</Name></AccountingCustomerParty>`,
    `  <LegalMonetaryTotal><TaxExclusiveAmount>${(rollup.taxable_base_minor/100).toFixed(2)}</TaxExclusiveAmount><TaxInclusiveAmount>${(rollup.total_minor/100).toFixed(2)}</TaxInclusiveAmount></LegalMonetaryTotal>`,
    `  <TaxTotal><TaxAmount>${(rollup.vat_minor/100).toFixed(2)}</TaxAmount></TaxTotal>`,
    `  <InvoiceHash>${hash}</InvoiceHash>`,
    `</Invoice>`,
  ].join("\n");
}

export async function buildZatcaInvoice(input: ZatcaInvoiceInput): Promise<ZatcaInvoiceOutput> {
  const rollup = computeInvoice(input.lines);
  const channel = chooseChannel(input.invoice_type);
  const canonical = JSON.stringify({
    uuid: input.invoice_uuid,
    no: input.invoice_no,
    type: input.invoice_type,
    issued: input.issued_at,
    seller: input.seller,
    buyer: input.buyer,
    totals: {
      taxable: rollup.taxable_base_minor,
      vat: rollup.vat_minor,
      total: rollup.total_minor,
    },
    prev: input.prev_hash ?? null,
  });
  const hash = await sha256Hex((input.prev_hash ?? "") + canonical);
  const qr = buildQr(input, rollup);
  const xml = buildSignedXml(input, rollup, hash);
  return {
    channel,
    invoice_uuid: input.invoice_uuid,
    invoice_no: input.invoice_no,
    rollup,
    hash,
    prev_hash: input.prev_hash ?? null,
    qr_tlv_base64: qr,
    signed_xml: xml,
    submitted_payload: {
      channel, uuid: input.invoice_uuid, no: input.invoice_no,
      type: input.invoice_type, totals: rollup, hash, qr,
    },
  };
}

/**
 * Simulate submission — real submit lives in a `zatca_gateway` module wired
 * to the ZATCA sandbox once creds are provided. Deterministic outcome so
 * demo flows behave predictably.
 */
export function simulateSubmit(input: ZatcaInvoiceOutput): {
  ok: boolean; irn: string; status: "cleared" | "reported" | "failed";
  error?: string;
} {
  const status = input.channel === "cleared" ? "cleared" : "reported";
  return { ok: true, irn: `IRN-${input.invoice_uuid.slice(0,8).toUpperCase()}`, status };
}