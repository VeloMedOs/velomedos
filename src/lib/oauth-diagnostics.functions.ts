import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

const OutcomeSchema = z.object({
  attemptId: z.string().min(1).max(80),
  outcome: z.enum([
    "started",
    "success",
    "linked_existing",
    "cancelled",
    "missing_email",
    "invalid_client",
    "role_not_provisioned",
    "network_error",
    "unknown_error",
  ]),
  code: z.string().max(120).optional(),
  intendedRole: z.string().max(40).optional(),
  resolvedRole: z.string().max(40).optional(),
  email: z.string().email().optional(),
  message: z.string().max(500).optional(),
  redirectUri: z.string().max(500).optional(),
  scopes: z.string().max(500).optional(),
  clientIdHint: z.string().max(80).optional(),
  referrer: z.string().max(500).optional(),
});

export const recordOAuthOutcome = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => OutcomeSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ua = getRequestHeader("user-agent") ?? null;
    let ip: string | null = null;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch { ip = null; }
    const referer = getRequestHeader("referer") ?? null;
    let userId: string | null = null;
    let email = data.email ?? null;
    try {
      const auth = getRequestHeader("authorization");
      if (auth?.startsWith("Bearer ")) {
        const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
        userId = u.user?.id ?? null;
        email = email ?? u.user?.email ?? null;
      }
    } catch { /* anonymous attempt */ }
    await supabaseAdmin.from("oauth_events").insert({
      attempt_id: data.attemptId,
      user_id: userId,
      email,
      provider: "google",
      outcome: data.outcome,
      code: data.code ?? null,
      intended_role: data.intendedRole ?? null,
      resolved_role: data.resolvedRole ?? null,
      user_agent: ua,
      ip,
      metadata: {
        ...(data.message ? { message: data.message } : {}),
        ...(data.redirectUri ? { redirect_uri: data.redirectUri } : {}),
        ...(data.scopes ? { scopes: data.scopes } : {}),
        ...(data.clientIdHint ? { client_id_hint: data.clientIdHint } : {}),
        ...(data.referrer ? { referrer: data.referrer } : referer ? { referrer: referer } : {}),
      },
    });
    return { ok: true };
  });

export const listRecentOAuthEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin",
    });
    if (!isSuper) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("oauth_events")
      .select("id,attempt_id,email,provider,outcome,code,intended_role,resolved_role,user_agent,ip,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { events: data ?? [] };
  });