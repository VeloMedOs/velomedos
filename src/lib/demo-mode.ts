/**
 * Demo-tenant detection.
 *
 * Single source of truth for the "is this the sandbox tenant?" check that
 * gateway clients, the reset endpoint, and the AppShell banner all consult.
 * The result is cached in-process per tenant id so request-handlers can call
 * it cheaply.
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
    .select("is_demo")
    .eq("id", tenantId)
    .maybeSingle();
  const value = Boolean(data?.is_demo);
  cache.set(tenantId, { value, expires: now + TTL_MS });
  return value || envForce();
}

export async function getDemoTenantId(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (serviceClient() as any)
    .from("corporate_accounts")
    .select("id")
    .eq("slug", DEMO_TENANT_SLUG)
    .maybeSingle();
  return data?.id ?? null;
}

export function invalidateDemoCache(tenantId?: string) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}