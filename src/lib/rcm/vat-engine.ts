/**
 * R7 · VAT engine (line/business-rule driven, 15% / 0%).
 *
 * Not stream-assumed: the invoice type doesn't decide VAT; each line's
 * business rule / service master decides. Insured encounter emits two
 * invoices — B2B (payer) + B2C (patient) — and every line carries a
 * vat_rate. Refund / credit-note lines carry a negative amount and post
 * to reporting_box=refund_adjustment.
 *
 * Partial-payment temporary VAT (§6, deterministic):
 *   VAT_Paid_BoxX = round(Settled_Gross / Open_Gross × Open_VAT_BoxX, 2)
 *
 * Excess = unapplied cash, VAT 0 until applied.
 *
 * All amounts are minor units (halalas) unless a helper says otherwise.
 */
export type VatRate = 0 | 15;

export type LineIn = {
  description?: string;
  service_code?: string | null;
  qty?: number;
  unit_price_minor: number;
  discount_minor?: number;
  vat_rate?: VatRate;
  reporting_code?: string | null;
};

export type LineOut = LineIn & {
  taxable_minor: number;
  vat_minor: number;
  total_minor: number;
};

export type InvoiceRollup = {
  gross_minor: number;
  discount_minor: number;
  taxable_base_minor: number;
  vat_minor: number;
  total_minor: number;
  effective_vat_rate: number;
  lines: LineOut[];
};

/** Bankers-safe round to 2 decimals (minor units are already integers). */
function rint(n: number): number { return Math.round(n); }

export function computeLine(l: LineIn): LineOut {
  const qty = l.qty ?? 1;
  const unit = Math.max(0, Math.round(l.unit_price_minor));
  const disc = Math.max(0, Math.round(l.discount_minor ?? 0));
  const rate: VatRate = (l.vat_rate ?? 15) as VatRate;
  const gross = rint(qty * unit);
  const taxable = Math.max(0, gross - disc);
  const vat = rint((taxable * rate) / 100);
  return { ...l, qty, discount_minor: disc, vat_rate: rate,
    taxable_minor: taxable, vat_minor: vat, total_minor: taxable + vat };
}

export function computeInvoice(lines: LineIn[]): InvoiceRollup {
  const out = lines.map(computeLine);
  const gross = out.reduce((s, l) => s + rint((l.qty ?? 1) * l.unit_price_minor), 0);
  const discount = out.reduce((s, l) => s + (l.discount_minor ?? 0), 0);
  const taxable = out.reduce((s, l) => s + l.taxable_minor, 0);
  const vat = out.reduce((s, l) => s + l.vat_minor, 0);
  const total = out.reduce((s, l) => s + l.total_minor, 0);
  const effRate = taxable > 0 ? Math.round((vat / taxable) * 10000) / 100 : 0;
  return { gross_minor: gross, discount_minor: discount,
    taxable_base_minor: taxable, vat_minor: vat, total_minor: total,
    effective_vat_rate: effRate, lines: out };
}

/**
 * Partial-payment temporary VAT allocation.
 * Given open invoice (gross, VAT per box) and a settled_gross amount,
 * returns the VAT portion that lands in each reporting box.
 */
export function partialVatAlloc(input: {
  settled_gross_minor: number;
  open_gross_minor: number;
  open_vat_by_box: Record<string, number>;
}): Record<string, number> {
  const out: Record<string, number> = {};
  const s = Math.max(0, input.settled_gross_minor);
  const o = Math.max(1, input.open_gross_minor); // prevent divide-by-zero
  const ratio = s / o;
  for (const [box, openVat] of Object.entries(input.open_vat_by_box)) {
    out[box] = rint(openVat * ratio);
  }
  return out;
}

/** Insured encounter dual-invoice split. */
export function splitInsuredEncounter(input: {
  claim_lines: LineIn[];               // payer-side (B2B)
  patient_lines: LineIn[];             // copay/deductible/uncovered (B2C)
}): { b2b: InvoiceRollup; b2c: InvoiceRollup } {
  return {
    b2b: computeInvoice(input.claim_lines),
    b2c: computeInvoice(input.patient_lines),
  };
}