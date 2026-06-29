/**
 * Phase-1 helper utilities for clinical routes.
 */
import { json } from "@/lib/api-clinical";
import { ZodError } from "zod";
import { serviceClient } from "@/lib/api-clinical";

export function envelope(error: string, code: string, status: number, extra?: Record<string, unknown>): Response {
  return json({ error, code, request_id: crypto.randomUUID(), ...(extra ?? {}) }, status);
}

export function zodError(e: ZodError): Response {
  return envelope("Validation failed", "validation_failed", 400, {
    issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code })),
  });
}

export function parseBody<T>(parser: (raw: unknown) => T) {
  return async (request: Request): Promise<{ ok: true; data: T } | { ok: false; res: Response }> => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return { ok: false, res: envelope("Invalid JSON body", "bad_json", 400) };
    }
    try {
      return { ok: true, data: parser(raw) };
    } catch (e) {
      if (e instanceof ZodError) return { ok: false, res: zodError(e) };
      return { ok: false, res: envelope("Validation failed", "validation_failed", 400) };
    }
  };
}

/**
 * Tenant-ownership guard. Loads the row by id and asserts tenant_id matches.
 * Returns 404 if missing or owned by another tenant.
 */
export async function loadOwned<T extends { tenant_id: string }>(
  table: string,
  id: string,
  tenantId: string,
  columns = "*",
): Promise<{ ok: true; row: T } | { ok: false; res: Response }> {
  const db = serviceClient();
  const { data, error } = await db
    .from(table as never)
    .select(columns)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, res: envelope(error.message, "db_error", 500) };
  if (!data || (data as unknown as T).tenant_id !== tenantId) {
    return { ok: false, res: envelope(`${table} not found`, "not_found", 404) };
  }
  return { ok: true, row: data as unknown as T };
}

export function jsonData(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Assert that a master row referenced from another payload (e.g. coverage.payer_id)
 * belongs to the current tenant. Returns null when fine, or a 404 envelope.
 */
export async function assertMasterOwnership(
  table: string,
  id: string | null | undefined,
  tenantId: string,
): Promise<Response | null> {
  if (!id) return null;
  const db = serviceClient();
  const { data } = await db.from(table as never).select("id, tenant_id").eq("id", id).maybeSingle();
  const row = data as { tenant_id?: string } | null;
  if (!row || row.tenant_id !== tenantId) {
    return envelope(`${table} not found`, "not_found", 404);
  }
  return null;
}
