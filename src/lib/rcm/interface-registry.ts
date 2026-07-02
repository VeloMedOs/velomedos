/**
 * R7 · Interface registry.
 *
 * Defines every outbound / inbound interface the platform speaks (D365,
 * ZATCA, POS, NPHIES family, CHI Discovery, Kayan HR, Coding, PACS/LIS)
 * and exposes `logCall(...)` — a thin helper that writes to `interface_log`.
 *
 * NPHIES entries wrap the shared Phase-9 gateway (never open a second
 * transport); the registry just registers the invocation for audit/retry.
 */
export type InterfaceKey =
  | "d365.finance"
  | "zatca.einvoice"
  | "pos.terminal"
  | "nphies.eligibility"
  | "nphies.auth"
  | "nphies.claims"
  | "nphies.remittance"
  | "nphies.cs_uhf"
  | "chi.discovery"
  | "kayan.hr"
  | "coder.medical"
  | "ancillary.pacs"
  | "ancillary.lis";

export type InterfaceMeta = {
  key: InterfaceKey;
  label: string;
  direction: "inbound" | "outbound" | "bidirectional";
  purpose: string;
  owner: "finance" | "rcm" | "clinical" | "admin";
};

export const INTERFACES: Record<InterfaceKey, InterfaceMeta> = {
  "d365.finance":       { key: "d365.finance",       label: "D365 Finance (ERP)",        direction: "bidirectional", owner: "finance", purpose: "Summary-level GL/AR postings; VAT + settlement ack." },
  "zatca.einvoice":     { key: "zatca.einvoice",     label: "ZATCA E-Invoicing",         direction: "outbound",      owner: "finance", purpose: "B2C simplified (reported) + B2B standard (cleared)." },
  "pos.terminal":       { key: "pos.terminal",       label: "POS Terminal",              direction: "bidirectional", owner: "finance", purpose: "Card capture + post collection result." },
  "nphies.eligibility": { key: "nphies.eligibility", label: "NPHIES · Eligibility",      direction: "bidirectional", owner: "rcm",     purpose: "Coverage discovery (R1) via shared gateway." },
  "nphies.auth":        { key: "nphies.auth",        label: "NPHIES · Authorization",    direction: "bidirectional", owner: "rcm",     purpose: "Pre-authorization request/response (R2)." },
  "nphies.claims":      { key: "nphies.claims",      label: "NPHIES · Claims",           direction: "outbound",      owner: "rcm",     purpose: "Claim/batch submission (Phase 7-9)." },
  "nphies.remittance":  { key: "nphies.remittance",  label: "NPHIES · Remittance",       direction: "inbound",       owner: "rcm",     purpose: "$process-message inbound (R5)." },
  "nphies.cs_uhf":      { key: "nphies.cs_uhf",      label: "NPHIES · CS-UHF",           direction: "outbound",      owner: "rcm",     purpose: "Cost sharing utilization / hospitalization feedback." },
  "chi.discovery":      { key: "chi.discovery",      label: "CHI Discovery",             direction: "bidirectional", owner: "rcm",     purpose: "Insurance discovery (R1)." },
  "kayan.hr":           { key: "kayan.hr",           label: "Kayan HR → HIS",            direction: "inbound",       owner: "admin",   purpose: "Provider/employee master sync (MDS dependency)." },
  "coder.medical":      { key: "coder.medical",      label: "Medical Coding",            direction: "bidirectional", owner: "clinical",purpose: "ADT/discharge → coder; coded result back." },
  "ancillary.pacs":     { key: "ancillary.pacs",     label: "PACS Imaging",              direction: "bidirectional", owner: "clinical",purpose: "Radiology orders/results/reports." },
  "ancillary.lis":      { key: "ancillary.lis",      label: "LIS Laboratory",            direction: "bidirectional", owner: "clinical",purpose: "Lab orders/results." },
};

export function listInterfaces(): InterfaceMeta[] {
  return Object.values(INTERFACES);
}

/**
 * Helper — server-side log write. The caller must own a service_client.
 * We accept `serviceClient` as a parameter so this file has no dependency
 * on the browser Supabase client.
 */
export async function logCall(opts: {
  db: any;
  tenantId: string;
  interfaceKey: InterfaceKey;
  direction?: "inbound" | "outbound" | "bidirectional";
  trigger?: string;
  correlationId?: string;
  payload?: unknown;
  response?: unknown;
  status?: "queued" | "sent" | "ack" | "failed" | "retrying" | "dead";
  error?: string | null;
}): Promise<{ id: string } | null> {
  const meta = INTERFACES[opts.interfaceKey];
  const row = {
    tenant_id: opts.tenantId,
    interface_name: meta?.label ?? opts.interfaceKey,
    direction: opts.direction ?? meta?.direction ?? "outbound",
    trigger: opts.trigger ?? null,
    correlation_id: opts.correlationId ?? null,
    payload: opts.payload ?? null,
    response: opts.response ?? null,
    status: opts.status ?? "queued",
    last_error: opts.error ?? null,
  };
  const { data, error } = await opts.db.from("interface_log").insert(row).select("id").single();
  if (error) return null;
  return { id: (data as { id: string }).id };
}