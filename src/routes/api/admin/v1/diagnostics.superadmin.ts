import { createFileRoute } from "@tanstack/react-router";
import { json, preflight, serviceClient } from "@/lib/api-server";

/**
 * Diagnostics endpoint for the /superadmin page.
 *
 * Validates the caller's Supabase bearer token and returns auth state,
 * resolved roles WITH the source table they came from, and tenant
 * membership. Intentionally does NOT require superadmin — denied users
 * need this endpoint to render their AccessDenied state with accurate
 * diagnostics.
 */

type RoleHit = {
  role: string;
  source: "user_roles" | "portal_role_assignments" | "tenant_members";
  tenant_id?: string | null;
};

export const Route = createFileRoute("/api/admin/v1/diagnostics/superadmin")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const request_id = crypto.randomUUID();
        const db = serviceClient();

        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";

        if (!bearer) {
          return json({
            authed: false,
            code: "AUTH_MISSING",
            user_id: null,
            email: null,
            email_verified: false,
            provider: null,
            roles: [] as RoleHit[],
            resolved_roles: [] as string[],
            tenants: [],
            owned_api_keys: 0,
            lookup_user_id: null,
            fetched_at: new Date().toISOString(),
            request_id,
          }, 200);
        }

        const { data: u, error: authErr } = await db.auth.getUser(bearer);
        if (authErr || !u?.user) {
          return json({
            authed: false,
            code: "AUTH_INVALID",
            error: authErr?.message ?? "invalid_session",
            user_id: null,
            email: null,
            email_verified: false,
            provider: null,
            roles: [] as RoleHit[],
            resolved_roles: [] as string[],
            tenants: [],
            owned_api_keys: 0,
            lookup_user_id: null,
            fetched_at: new Date().toISOString(),
            request_id,
          }, 200);
        }

        const userId = u.user.id;

        const [urRes, prRes, tmRes, keyCountRes] = await Promise.all([
          db.from("user_roles").select("role").eq("user_id", userId),
          (db as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: { role: string }[] | null; error: { message: string } | null }> } } })
            .from("portal_role_assignments").select("role").eq("user_id", userId),
          (db as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => Promise<{ data: { tenant_id: string; role: string; corporate_accounts: { company_name: string | null; slug: string | null } | null }[] | null; error: { message: string } | null }> } } })
            .from("tenant_members").select("tenant_id, role, corporate_accounts(company_name, slug)").eq("user_id", userId),
          db.from("api_keys").select("id", { count: "exact", head: true }).eq("owner_id", userId),
        ]);

        const roles: RoleHit[] = [];
        for (const r of urRes.data ?? []) roles.push({ role: r.role as string, source: "user_roles" });
        for (const r of prRes.data ?? []) roles.push({ role: r.role, source: "portal_role_assignments" });
        for (const m of tmRes.data ?? []) roles.push({ role: m.role, source: "tenant_members", tenant_id: m.tenant_id });

        const resolved_roles = Array.from(new Set([
          ...(urRes.data ?? []).map((r) => r.role as string),
          ...(prRes.data ?? []).map((r) => r.role),
        ]));

        const tenants = (tmRes.data ?? []).map((m) => ({
          tenant_id: m.tenant_id,
          role: m.role,
          company_name: m.corporate_accounts?.company_name ?? null,
          slug: m.corporate_accounts?.slug ?? null,
        }));

        return json({
          authed: true,
          code: resolved_roles.includes("superadmin") ? "OK" : (resolved_roles.length === 0 ? "NO_ROLES_ASSIGNED" : "ROLE_INSUFFICIENT"),
          user_id: userId,
          lookup_user_id: userId,
          email: u.user.email ?? null,
          email_verified: !!u.user.email_confirmed_at,
          provider: (u.user.app_metadata as { provider?: string } | null)?.provider ?? null,
          roles,
          resolved_roles,
          role_errors: {
            user_roles: urRes.error?.message ?? null,
            portal_role_assignments: prRes.error?.message ?? null,
            tenant_members: tmRes.error?.message ?? null,
          },
          tenants,
          owned_api_keys: keyCountRes.count ?? 0,
          fetched_at: new Date().toISOString(),
          request_id,
        }, 200);
      },
    },
  },
});