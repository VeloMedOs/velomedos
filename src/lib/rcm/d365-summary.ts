/**
 * R7 · D365 daily summary builder.
 *
 * D365 receives **summary-level** GL/AR postings (not line detail) covering:
 *   - cash collections (grouped by method + reporting_box)
 *   - cash refunds (grouped by method + reporting_box)
 *   - deposits (collected / applied / refunded)
 *   - payer remittance acknowledgements (R5)
 *   - VAT output/input/clearing per GL account (225320 / 225330 / 225340)
 *
 * The output shape is designed for the D365 interface adapter to consume
 * directly; no additional aggregation should be required downstream.
 */
export type D365SummaryLine = {
  bucket: "collection" | "refund" | "deposit" | "remittance_ack";
  method?: string | null;
  reporting_box?: string | null;
  gl_account?: string | null;
  count: number;
  amount_minor: number;
  vat_minor: number;
};

export type D365DailySummary = {
  tenant_id: string;
  date: string;                          // YYYY-MM-DD
  currency: string;
  totals: {
    collections_minor: number;
    refunds_minor: number;
    deposits_in_minor: number;
    deposits_out_minor: number;
    remittance_ack_minor: number;
    vat_output_minor: number;
    vat_input_minor: number;
  };
  lines: D365SummaryLine[];
  correlation_id: string;
};

function push(map: Map<string, D365SummaryLine>, key: string, base: D365SummaryLine) {
  const cur = map.get(key);
  if (!cur) { map.set(key, { ...base }); return; }
  cur.count += base.count;
  cur.amount_minor += base.amount_minor;
  cur.vat_minor += base.vat_minor;
}

export function buildD365Summary(input: {
  tenant_id: string;
  date: string;
  currency?: string;
  collections: Array<{ method: string; reporting_box?: string; amount_minor: number; vat_minor?: number }>;
  refunds:     Array<{ method: string; reporting_box?: string; amount_minor: number; vat_minor?: number }>;
  deposits_in: Array<{ amount_minor: number }>;
  deposits_out: Array<{ amount_minor: number }>;
  remittance_ack: Array<{ amount_minor: number }>;
}): D365DailySummary {
  const map = new Map<string, D365SummaryLine>();
  let colls = 0, refs = 0, dIn = 0, dOut = 0, ack = 0, vOut = 0, vIn = 0;

  for (const c of input.collections) {
    push(map, `col|${c.method}|${c.reporting_box ?? ""}`, {
      bucket: "collection", method: c.method, reporting_box: c.reporting_box ?? null,
      gl_account: "225320", count: 1, amount_minor: c.amount_minor, vat_minor: c.vat_minor ?? 0,
    });
    colls += c.amount_minor;
    vOut += c.vat_minor ?? 0;
  }
  for (const r of input.refunds) {
    push(map, `ref|${r.method}|${r.reporting_box ?? "refund_adjustment"}`, {
      bucket: "refund", method: r.method, reporting_box: r.reporting_box ?? "refund_adjustment",
      gl_account: "225320", count: 1, amount_minor: -r.amount_minor, vat_minor: -(r.vat_minor ?? 0),
    });
    refs += r.amount_minor;
    vOut -= r.vat_minor ?? 0;
  }
  for (const d of input.deposits_in) {
    push(map, `dep_in`, { bucket: "deposit", method: null, gl_account: "225340", count: 1, amount_minor: d.amount_minor, vat_minor: 0 });
    dIn += d.amount_minor;
  }
  for (const d of input.deposits_out) {
    push(map, `dep_out`, { bucket: "deposit", method: null, gl_account: "225340", count: 1, amount_minor: -d.amount_minor, vat_minor: 0 });
    dOut += d.amount_minor;
  }
  for (const a of input.remittance_ack) {
    push(map, `remit_ack`, { bucket: "remittance_ack", method: null, gl_account: "225330", count: 1, amount_minor: a.amount_minor, vat_minor: 0 });
    ack += a.amount_minor;
  }

  return {
    tenant_id: input.tenant_id,
    date: input.date,
    currency: input.currency ?? "SAR",
    totals: {
      collections_minor: colls, refunds_minor: refs,
      deposits_in_minor: dIn, deposits_out_minor: dOut,
      remittance_ack_minor: ack, vat_output_minor: vOut, vat_input_minor: vIn,
    },
    lines: [...map.values()],
    correlation_id: `D365-${input.tenant_id.slice(0,8)}-${input.date}`,
  };
}