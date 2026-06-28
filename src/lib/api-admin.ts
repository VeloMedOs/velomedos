import { json, preflight, serviceClient } from "@/lib/api-server";

/**
 * Admin (Superadmin Control Plane) API auth.
 *
 * Accepts either:
 *  1. A scoped portal API key in `x-admin-key` (hashed lookup against `portal_api_keys`)
 *  2. A signed-in portal-staff session bearer token (validated via Supabase Auth + `is_portal_staff`)
 *
 * Returns a consistent error envelope: { error, code, request_id }.
 */
export type AdminAuth =
  | { ok: true; userId: string | null; keyId: string; scopes: string[]; via: "key" | "session" }
  | { ok: false; res: Response };

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function err(message: string, code: string, status: number): Response {
  return json({ error: message, code, request_id: crypto.randomUUID() }, status);
}

export async function requireAdmin(request: Request, requiredScope?: string): Promise<AdminAuth> {
  const raw = request.headers.get("x-admin-key");
  const db = serviceClient();

  if (raw) {
    const hashed = await sha256Hex(raw);
    const { data } = await db.from("portal_api_keys")
      .select("id, owner_id, scopes, revoked_at")
      .eq("hashed_key", hashed)
      .maybeSingle();
    if (!data || data.revoked_at) return { ok: false, res: err("invalid_admin_key", "auth/invalid_key", 401) };
    const scopes = ((data as { scopes: string[] | null }).scopes ?? []) as string[];
    if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes("*")) {
      return { ok: false, res: err(`missing_scope:${requiredScope}`, "auth/forbidden", 403) };
    }
    db.from("portal_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
    return { ok: true, userId: (data as { owner_id: string }).owner_id, keyId: data.id, scopes, via: "key" };
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!bearer) return { ok: false, res: err("missing_credentials", "auth/missing", 401) };
  const { data: u } = await db.auth.getUser(bearer);
  if (!u?.user) return { ok: false, res: err("invalid_session", "auth/invalid_session", 401) };
  const { data: staff } = await db.rpc("is_portal_staff", { _user_id: u.user.id });
  if (!staff) return { ok: false, res: err("not_portal_staff", "auth/forbidden", 403) };
  return { ok: true, userId: u.user.id, keyId: `session:${u.user.id}`, scopes: ["*"], via: "session" };
}

/** Append a portal_audit row. Best-effort. */
export async function adminAudit(actorId: string | null, action: string, target: string | null, targetId: string | null, payload: unknown) {
  try {
    await serviceClient().from("portal_audit").insert({
      actor_id: actorId, action, target, target_id: targetId,
      payload: (payload as never) ?? null,
    });
  } catch { /* noop */ }
}

export { json, preflight, serviceClient };

/** Loose-typed Supabase client for admin handlers — avoids fighting the regenerated `Database` type
 *  for the new `portal_*` tables which are added in the same prompt and not yet in the typegen. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adminDb(): any { return serviceClient() as unknown as any; }