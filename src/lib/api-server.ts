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
  "access-control-allow-headers": "content-type, x-api-key",
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

export async function requireKey(request: Request): Promise<{ ok: true; ownerId: string; keyId: string } | { ok: false; res: Response }> {
  const raw = request.headers.get("x-api-key");
  if (!raw) return { ok: false, res: json({ error: "Missing x-api-key header" }, 401) };
  const hashed = await sha256Hex(raw);
  const db = serviceClient();
  const { data, error } = await db.from("api_keys").select("id, owner_id").eq("hashed_key", hashed).maybeSingle();
  if (error || !data) return { ok: false, res: json({ error: "Invalid API key" }, 401) };
  // fire-and-forget last_used update
  db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return { ok: true, ownerId: data.owner_id, keyId: data.id };
}