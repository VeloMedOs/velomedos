import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function serviceClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-api-key, x-velomed-signature",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, init: number | ResponseInit = 200): Response {
  const status = typeof init === "number" ? init : init.status ?? 200;
  const headers = { "content-type": "application/json", ...CORS };
  return new Response(JSON.stringify(body), { status, headers });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

// in-process token bucket. Single dev-server instance → adequate for the demo runtime.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
function checkRate(keyId: string, limit: number): { ok: true; remaining: number } | { ok: false } {
  const now = Date.now();
  const b = buckets.get(keyId);
  if (!b || b.resetAt <= now) {
    buckets.set(keyId, { count: 1, resetAt: now + 60_000 });
    return { ok: true, remaining: limit - 1 };
  }
  if (b.count >= limit) return { ok: false };
  b.count += 1;
  return { ok: true, remaining: limit - b.count };
}

export type KeyAuth = { ownerId: string; keyId: string; scopes: string[]; rateLimit: number };

export async function requireKey(
  request: Request,
  requiredScope?: string,
): Promise<{ ok: true; auth: KeyAuth; ownerId: string; keyId: string } | { ok: false; res: Response }> {
  const raw = request.headers.get("x-api-key");
  // Allow signed-in admin/dispatcher sessions to call the public API directly
  // (so internal UIs such as the Fleet drawer exercise the same endpoints third-parties use).
  if (!raw) {
    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    if (bearer) {
      const db = serviceClient();
      const { data: u } = await db.auth.getUser(bearer);
      if (u?.user) {
        const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
        const set = new Set((roles ?? []).map((r) => r.role));
        if (set.has("admin") || set.has("dispatcher")) {
          return {
            ok: true,
            ownerId: u.user.id,
            keyId: `session:${u.user.id}`,
            auth: { ownerId: u.user.id, keyId: `session:${u.user.id}`, scopes: ["*"], rateLimit: 600 },
          };
        }
      }
    }
    return { ok: false, res: json({ error: "Missing x-api-key header" }, 401) };
  }
  const hashed = await sha256Hex(raw);
  const db = serviceClient();
  const { data, error } = await db
    .from("api_keys")
    .select("id, owner_id, scopes, rate_limit_per_min")
    .eq("hashed_key", hashed)
    .maybeSingle();
  if (error || !data) return { ok: false, res: json({ error: "Invalid API key" }, 401) };
  const scopes = (data.scopes as string[] | null) ?? [];
  if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes("*")) {
    return { ok: false, res: json({ error: `Missing required scope: ${requiredScope}` }, 403) };
  }
  const rl = checkRate(data.id, data.rate_limit_per_min ?? 60);
  if (!rl.ok) return { ok: false, res: json({ error: "Rate limit exceeded" }, 429) };
  // fire-and-forget last_used update
  db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return {
    ok: true,
    ownerId: data.owner_id,
    keyId: data.id,
    auth: { ownerId: data.owner_id, keyId: data.id, scopes, rateLimit: data.rate_limit_per_min ?? 60 },
  };
}

/** Append an audit_log row. Best-effort, swallows errors. */
export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, payload?: unknown) {
  try {
    await serviceClient().from("audit_log").insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId ?? null,
      payload: (payload as never) ?? null,
    });
  } catch { /* noop */ }
}