/**
 * Clinical data-plane auth helpers for the Mini-HIS vertical (/api/clinical/v1).
 *
 * Mirrors src/lib/api-server.ts (which serves the admin and public planes) but
 * resolves the caller into a tenant context via `tenant_members`, and surfaces
 * the standardised `{ error, code, request_id }` envelope.
 */
import { json, preflight, serviceClient } from "./api-server";
import {
  CLINICAL_CAPABILITIES,
  canViewModule,
  isReadOnly,
  type ClinicalRole,
} from "./clinical-role-matrix";

export { json, preflight, serviceClient };
export type { ClinicalRole };

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
 * Module-scoped guard. Resolves the tenant context, then enforces:
 *   - `read_only` may only GET (HEAD/OPTIONS pass through);
 *   - any other role must hold ≥1 action capability in the module
 *     (or, if `capId` is supplied, must specifically be allowed that action).
 * `tenant_admin` is implicitly allowed.
 */
export async function requireClinicalModule(
  request: Request,
  module: string,
  options: { capId?: string } = {},
): Promise<{ ok: true; ctx: TenantContext } | { ok: false; res: Response }> {
  const result = await requireTenant(request);
  if (!result.ok) return result;
  const { clinicalRole } = result.ctx;
  if (!clinicalRole) {
    return { ok: false, res: errorResponse("Clinical role not assigned", "clinical_role_missing", 403) };
  }
  if (clinicalRole === "tenant_admin") return result;

  const method = request.method.toUpperCase();
  const isRead = method === "GET" || method === "HEAD" || method === "OPTIONS";

  if (isReadOnly(clinicalRole)) {
    if (!isRead) {
      return { ok: false, res: errorResponse("Read-only role cannot write", "clinical_read_only", 403) };
    }
    // read_only sees every permitted module by definition.
    return result;
  }

  // Read-permissive model: any clinical tenant member may GET any module
  // (RLS still scopes the data per-tenant). Writes require an action
  // capability — either the specific `capId` if supplied, or ≥1 cap in
  // the module. A small allow-list of sensitive modules / caps gates GET
  // on the capability as well.
  if (isRead) {
    const moduleReadGated = READ_GATED_MODULES.has(module);
    const capReadGated = !!options.capId && READ_GATED_CAPS.has(options.capId);
    if (!moduleReadGated && !capReadGated) return result;
  }

  if (options.capId) {
    const cap = CLINICAL_CAPABILITIES.find((c) => c.id === options.capId);
    if (!cap || !cap.roles.includes(clinicalRole)) {
      return { ok: false, res: errorResponse(`Requires capability: ${options.capId}`, "clinical_capability_forbidden", 403) };
    }
    return result;
  }

  const hasAction = CLINICAL_CAPABILITIES.some(
    (c) => c.module === module && c.roles.includes(clinicalRole),
  );
  if (!hasAction) {
    return { ok: false, res: errorResponse(`Requires action capability in: ${module}`, "clinical_module_forbidden", 403) };
  }
  return result;
}

/**
 * Modules where even GET requires an explicit action capability — finance &
 * cash visibility is treated as a write-grade privilege.
 */
export const READ_GATED_MODULES = new Set<string>(["Cash & ZATCA"]);

/**
 * Specific capability ids where GET requires the capability (e.g. posting
 * remittances or approving a refund — sensitive even to read).
 */
export const READ_GATED_CAPS = new Set<string>(["claim.post", "dep.approve"]);

/** Alias kept for new routes — semantics identical to requireClinicalModule. */
export const requireModule = requireClinicalModule;

/** Helper: enforces non-GET methods must use the write path explicitly. */
export async function requireClinicalRead(
  request: Request,
  module: string,
): Promise<{ ok: true; ctx: TenantContext } | { ok: false; res: Response }> {
  const method = request.method.toUpperCase();
  if (!(method === "GET" || method === "HEAD" || method === "OPTIONS")) {
    throw new Error(`requireClinicalRead called with ${method} on module ${module} — use requireClinicalWrite`);
  }
  return requireClinicalModule(request, module);
}

/** Helper for write paths; capId optional. */
export async function requireClinicalWrite(
  request: Request,
  module: string,
  options: { capId?: string } = {},
): Promise<{ ok: true; ctx: TenantContext } | { ok: false; res: Response }> {
  return requireClinicalModule(request, module, options);
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