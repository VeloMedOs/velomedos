import { supabase } from "@/integrations/supabase/client";

/** Fetch helper for /api/admin/v1/* that injects the current Supabase bearer
 *  so superadmin pages can drive the admin API the same way external tooling
 *  would (via session). Throws on non-2xx with the API error envelope. */
export async function adminFetch<T = unknown>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (session?.access_token) headers.set("authorization", `Bearer ${session.access_token}`);
  let body: BodyInit | undefined;
  if (init?.body !== undefined && init?.body !== null) {
    if (typeof init.body === "string" || init.body instanceof FormData) {
      body = init.body as BodyInit;
    } else {
      headers.set("content-type", "application/json");
      body = JSON.stringify(init.body);
    }
  }
  const res = await fetch(path, { ...init, headers, body });
  const text = await res.text();
  const json = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!res.ok) {
    const msg = (json && (json.error as string)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}