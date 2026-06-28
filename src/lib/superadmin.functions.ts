import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const SUPERADMIN_EMAIL = "superadmin@velomedos.com";

/** Ensure the superadmin user exists in auth.users with the password from
 *  the SUPERADMIN_SECRET project secret, and that the `superadmin` role is
 *  granted in `user_roles`. Idempotent. Safe to call from the login page on
 *  every cold start. */
export const bootstrapSuperadmin = createServerFn({ method: "POST" }).handler(async () => {
  const password = process.env.SUPERADMIN_SECRET;
  if (!password) {
    return { ok: false as const, error: "SUPERADMIN_SECRET is not configured" };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Look up by email via listUsers (Admin API). With a single superadmin,
  // page size 200 is more than enough.
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return { ok: false as const, error: listErr.message };
  const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === SUPERADMIN_EMAIL);

  let userId: string;
  if (!existing) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: SUPERADMIN_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: "VeloMed Superadmin" },
    });
    if (createErr || !created.user) return { ok: false as const, error: createErr?.message ?? "create_failed" };
    userId = created.user.id;
  } else {
    userId = existing.id;
  }

  // Always (re)grant the role; cheap upsert.
  await supabaseAdmin.from("user_roles").upsert(
    { user_id: userId, role: "superadmin" },
    { onConflict: "user_id,role" },
  );

  return { ok: true as const, userId, created: !existing };
});

/** Reset the superadmin password back to the SUPERADMIN_SECRET value.
 *  Useful when no email is reachable; only the holder of the secret can do
 *  this because it runs server-side with the secret as the source of truth. */
export const resetSuperadminToSecret = createServerFn({ method: "POST" }).handler(async () => {
  const password = process.env.SUPERADMIN_SECRET;
  if (!password) return { ok: false as const, error: "SUPERADMIN_SECRET is not configured" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => (u.email ?? "").toLowerCase() === SUPERADMIN_EMAIL);
  if (!existing) return { ok: false as const, error: "superadmin_not_bootstrapped" };
  const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
});

/** Create an operator (developer, call-center agent, dispatcher, etc.) with
 *  a one-time password the superadmin hands to them. Only callable by the
 *  signed-in superadmin. Returns the temporary password in the response so
 *  the superadmin can copy it; the value is NOT stored in plaintext. */
const CreateOperatorInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  full_name: z.string().trim().min(1).max(120),
  role: z.enum([
    "admin", "dispatcher", "developer", "business_admin",
    "paramedic", "driver", "patient",
  ]),
  send_email: z.boolean().optional(),
});

function generateTempPassword(): string {
  // 16 chars: upper, lower, digit, symbol — meets HIBP-strong defaults.
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const a = "abcdefghijkmnpqrstuvwxyz";
  const d = "23456789";
  const s = "!@#$%^*?";
  const all = A + a + d + s;
  const buf = new Uint8Array(20);
  crypto.getRandomValues(buf);
  const pick = (set: string, i: number) => set[buf[i] % set.length];
  const chars = [pick(A, 0), pick(a, 1), pick(d, 2), pick(s, 3)];
  for (let i = 4; i < 16; i++) chars.push(pick(all, i));
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = buf[i + 3] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export const createOperator = createServerFn({ method: "POST" })
  .inputValidator((data) => CreateOperatorInput.parse(data))
  .handler(async ({ data }) => {
    const { requireSupabaseAuth } = await import("@/integrations/supabase/auth-middleware");
    void requireSupabaseAuth; // documents intent; gate below uses raw bearer
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Authorize: caller must be a superadmin.
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const auth = getRequestHeader("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (!token) return { ok: false as const, error: "unauthorized" };
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    if (!u?.user) return { ok: false as const, error: "unauthorized" };
    const { data: hasRole } = await supabaseAdmin.rpc("has_role", { _user_id: u.user.id, _role: "superadmin" });
    if (!hasRole) return { ok: false as const, error: "forbidden" };

    const tempPassword = generateTempPassword();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, must_change_password: true },
    });
    if (createErr || !created.user) {
      return { ok: false as const, error: createErr?.message ?? "create_failed" };
    }
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: created.user.id, role: data.role },
      { onConflict: "user_id,role" },
    );
    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      email: data.email,
      full_name: data.full_name,
      default_role: data.role,
    });

    return {
      ok: true as const,
      user_id: created.user.id,
      email: data.email,
      role: data.role,
      temporary_password: tempPassword,
    };
  });
