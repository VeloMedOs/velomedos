/**
 * Clinical data-plane auth helpers for the Mini-HIS vertical (/api/clinical/v1).
 *
 * Mirrors src/lib/api-server.ts (which serves the admin and public planes) but
 * resolves the caller into a tenant context via `tenant_members`, and surfaces
 * the standardised `{ error, code, request_id }` envelope.
 */
import { json, preflight, serviceClient } from "./api-server";

export { json, preflight, serviceClient };

export type ClinicalRole =
  | "registrar"
  | "physician"
  | "nurse"
  | "lab_tech"
  | "radiologist"
  | "pharmacist"
  | "coder"
  | "case_manager"
  | "cashier"
  | "tenant_admin"
  | "read_only";

export type TenantContext = {
  userId: string;
  tenantId: string;
  role: string;
  clinicalRole: ClinicalRole | null;
};

function errorResponse(error: string, code: string, status: number): Response {
  return json({ error, code, request_id: crypto.randomUUID() }, status);
}

/**
 * Resolve the bearer token to a tenant membership.
 * Returns the first membership if the user belongs to multiple tenants — callers
 * that need cross-tenant routing should pass an explicit `x-tenant-id` header
 * (handled here when present).
 */
export async function requireTenant(
  request: Request,
): Promise<{ ok: true; ctx: TenantContext } | { ok: false; res: Response }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) {
    return { ok: false, res: errorResponse("Missing bearer token", "auth_missing", 401) };
  }

  const db = serviceClient();
  const { data: u, error: uErr } = await db.auth.getUser(bearer);
  if (uErr || !u?.user) {
    return { ok: false, res: errorResponse("Invalid bearer token", "auth_invalid", 401) };
  }

  const requestedTenant = request.headers.get("x-tenant-id");
  let query = db
    .from("tenant_members")
    .select("tenant_id, role, clinical_role")
    .eq("user_id", u.user.id);
  if (requestedTenant) query = query.eq("tenant_id", requestedTenant);

  const { data: rows, error: mErr } = await query.limit(1);
  if (mErr) {
    return { ok: false, res: errorResponse("Tenant lookup failed", "tenant_lookup_failed", 500) };
  }
  const row = rows?.[0];
  if (!row) {
    return { ok: false, res: errorResponse("Not a member of any tenant", "tenant_forbidden", 403) };
  }

  return {
    ok: true,
    ctx: {
      userId: u.user.id,
      tenantId: row.tenant_id as string,
      role: (row.role as string) ?? "member",
      clinicalRole: (row.clinical_role as ClinicalRole | null) ?? null,
    },
  };
}

/**
 * Like requireTenant, but also asserts the member's clinical_role is in `roles`.
 * `tenant_admin` is implicitly allowed for any clinical-role gate.
 */
export async function requireClinicalRole(
  request: Request,
  roles: ClinicalRole[],
): Promise<{ ok: true; ctx: TenantContext } | { ok: false; res: Response }> {
  const result = await requireTenant(request);
  if (!result.ok) return result;
  const { clinicalRole } = result.ctx;
  const allowed = new Set<ClinicalRole>([...roles, "tenant_admin"]);
  if (!clinicalRole || !allowed.has(clinicalRole)) {
    return {
      ok: false,
      res: errorResponse(
        `Requires clinical role in: ${roles.join(", ")}`,
        "clinical_role_forbidden",
        403,
      ),
    };
  }
  return result;
}

/**
 * Best-effort audit row. Never throws — clinical writes must not fail because
 * the audit log is briefly unavailable.
 */
export async function clinicalAudit(
  actorId: string | null,
  tenantId: string,
  action: string,
  target?: string,
  targetId?: string,
  payload?: unknown,
): Promise<void> {
  try {
    await serviceClient().from("clinical_audit").insert({
      tenant_id: tenantId,
      actor_id: actorId,
      action,
      target: target ?? null,
      target_id: targetId ?? null,
      payload: (payload as never) ?? null,
    });
  } catch {
    /* noop */
  }
}