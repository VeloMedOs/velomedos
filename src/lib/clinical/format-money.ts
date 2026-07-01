/**
 * Shared money util — RCM/HIS render integer halalas (SAR minor units) as
 * tabular JetBrains-Mono strings. Never render bare floats.
 *
 * The Daylight UI conformance addendum makes this mandatory across every
 * RCM-facing surface (bills, claims, remittance, deposits, ZATCA invoices).
 */

const DEFAULT_LOCALE = "en-SA";

export function halalasToMajor(minor: number | null | undefined): number {
  return typeof minor === "number" ? minor / 100 : 0;
}

/**
 * Format an integer-halalas amount as a currency string.
 *   formatHalalas(15075)          -> "150.75 SAR"
 *   formatHalalas(15075, { currency: "SAR", locale: "ar-SA" })
 */
export function formatHalalas(
  minor: number | null | undefined,
  opts: { currency?: string; locale?: string; withSymbol?: boolean } = {},
): string {
  const cur = opts.currency ?? "SAR";
  const locale = opts.locale ?? DEFAULT_LOCALE;
  const amount = halalasToMajor(minor);
  const nf = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
  const body = nf.format(amount);
  return opts.withSymbol === false ? body : `${body} ${cur}`;
}