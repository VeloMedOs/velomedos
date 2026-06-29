/**
 * NPHIES / KSA identifier system URIs used in FHIR R4 mappings.
 *
 * NOTE: These URIs SHOULD be sourced from the `code_system` / `code_value`
 * tables once the LOV loader (Phase 3/10) is in place — payer acceptance of
 * a Claim bundle requires exact-match URIs. The constants below are a
 * pragmatic Phase-1 default and must be cross-checked against the current
 * NPHIES Implementation Guide before any production submission.
 */

export const NPHIES_IDENTIFIER_SYSTEM: Record<string, string> = {
  NI: "http://nphies.sa/identifier/nationalid",
  IQAMA: "http://nphies.sa/identifier/iqama",
  PRC: "http://nphies.sa/identifier/iqama",
  PPN: "http://nphies.sa/identifier/passportnumber",
  GCC: "http://nphies.sa/identifier/gccid",
  BORDER: "http://nphies.sa/identifier/bordernumber",
  VISA: "http://nphies.sa/identifier/visa",
};

export function identifierSystemFor(docType: string): string {
  const key = (docType || "").toUpperCase();
  return NPHIES_IDENTIFIER_SYSTEM[key] ?? `urn:nphies:identifier:${key.toLowerCase() || "unknown"}`;
}

export const NPHIES_PAYER_SYSTEM = "http://nphies.sa/license/payer-license";
export const NPHIES_TPA_SYSTEM = "http://nphies.sa/license/tpa-license";

/**
 * NPHIES Coverage relationship code mapping (SubscriberRelationship LOV).
 * Falls back to `other` when unmapped — Phase 10 strict validation will reject.
 */
export const COVERAGE_RELATIONSHIP_LOV: Record<string, string> = {
  self: "self",
  spouse: "spouse",
  child: "child",
  common: "common",
  injured: "injured",
  parent: "parent",
  other: "other",
};

export function relationshipCode(rel: string | null | undefined): string {
  const v = (rel || "").toLowerCase();
  return COVERAGE_RELATIONSHIP_LOV[v] ?? "other";
}
