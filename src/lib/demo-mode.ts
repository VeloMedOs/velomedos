/**
 * Demo-tenant detection.
 *
 * Single source of truth for the "is this the sandbox tenant?" check that
 * gateway clients, the reset endpoint, and the AppShell banner all consult.
 * Reads `corporate_accounts.tenant_type = 'sandbox'` (Round 1 replaces the
 * legacy `is_demo` boolean with the `tenant_type` enum). Cached per tenant
 * for cheap re-checks in request handlers.
 */
import { serviceClient } from "@/lib/api-server";

const cache = new Map<string, { value: boolean; expires: number }>();
const TTL_MS = 60_000;

export const DEMO_TENANT_SLUG = "demo-hospital";

function envForce(): boolean {
  return String(process.env.DEMO_MODE ?? "").toLowerCase() === "true";
}

/** Pure predicate — exposed for unit tests so the tenant_type semantics
 *  can be asserted without touching the DB or the module-scope cache. */
export function computeIsDemo(row: { tenant_type?: string | null } | null | undefined, force: boolean): boolean {
  return force || row?.tenant_type === "sandbox";
}

/** Pure predicate for `getDemoTenantId` defensive check. */
export function resolveDemoTenantId(row: { id?: string | null; tenant_type?: string | null } | null | undefined): string | null {
  if (!row || row.tenant_type !== "sandbox") return null;
  return row.id ?? null;
}

export async function isDemoTenant(tenantId: string | null | undefined): Promise<boolean> {
  const force = envForce();
  if (!tenantId) return force;
  const hit = cache.get(tenantId);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value || force;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (serviceClient() as any)
    .from("corporate_accounts")
    .select("tenant_type")
    .eq("id", tenantId)
    .maybeSingle();
  const value = computeIsDemo(data, false);
  cache.set(tenantId, { value, expires: now + TTL_MS });
  return value || force;
}

export async function getDemoTenantId(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (serviceClient() as any)
    .from("corporate_accounts")
    .select("id, tenant_type")
    .eq("slug", DEMO_TENANT_SLUG)
    .maybeSingle();
  return resolveDemoTenantId(data);
}

export function invalidateDemoCache(tenantId?: string) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}