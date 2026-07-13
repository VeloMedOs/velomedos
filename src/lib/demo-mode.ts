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

export async function isDemoTenant(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return envForce();
  const hit = cache.get(tenantId);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value || envForce();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (serviceClient() as any)
    .from("corporate_accounts")
    .select("tenant_type")
    .eq("id", tenantId)
    .maybeSingle();
  const value = data?.tenant_type === "sandbox";
  cache.set(tenantId, { value, expires: now + TTL_MS });
  return value || envForce();
}

export async function getDemoTenantId(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (serviceClient() as any)
    .from("corporate_accounts")
    .select("id, tenant_type")
    .eq("slug", DEMO_TENANT_SLUG)
    .maybeSingle();
  // Defensive: refuse to hand back the id if the slug-tagged row is not
  // actually a sandbox tenant (guards against future migrations that might
  // reuse the demo slug for a production tenant).
  if (!data || data.tenant_type !== "sandbox") return null;
  return data.id ?? null;
}

export function invalidateDemoCache(tenantId?: string) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}