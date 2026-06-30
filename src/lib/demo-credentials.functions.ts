/**
 * Demo credentials — server functions backing the Superadmin generator
 * panel and the public /demo-login auto-fill flow.
 *
 * Public surface area is intentionally tiny:
 *   - listDemoCredentials      : Superadmin only. Full rows + last-rotated.
 *   - rotateDemoCredential     : Superadmin only. New password for one row.
 *   - rotateAllDemoCredentials : Superadmin only. New password for all rows.
 *   - applyCredentialsToAuth   : Superadmin only. Sync passwords into Supabase
 *                                Auth so the rows match what users type.
 *   - setPublicReveal          : Superadmin only. Toggle the public flag.
 *   - getDemoPublicState       : Public. Returns either the full account list
 *                                with passwords (when public reveal is on)
 *                                or a stripped list without passwords.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DemoCredentialRow = {
  email: string;
  role_label: string;
  clinical_role: string | null;
  lands_on: string;
  password: string;
  sort_order: number;
  updated_at: string;
  applied_at: string | null;
};

export type DemoPublicAccount = {
  email: string;
  role_label: string;
  clinical_role: string | null;
  lands_on: string;
  /** Only present when `reveal` is true. */
  password?: string;
};

const FALLBACK_PUBLIC_ACCOUNTS: DemoPublicAccount[] = [
  { email: "superadmin@demo.velomedos.com", role_label: "Demo Superadmin", clinical_role: null, lands_on: "/superadmin" },
  { email: "admin@demo.velomedos.com", role_label: "Tenant Admin", clinical_role: "tenant_admin", lands_on: "/clinical?tab=encounters" },
  { email: "doctor@demo.velomedos.com", role_label: "Physician", clinical_role: "physician", lands_on: "/clinical?tab=encounters" },
  { email: "nurse@demo.velomedos.com", role_label: "Nurse", clinical_role: "nurse", lands_on: "/clinical?tab=encounters" },
  { email: "coder@demo.velomedos.com", role_label: "Clinical Coder", clinical_role: "coder", lands_on: "/clinical?tab=coding" },
  { email: "rcm@demo.velomedos.com", role_label: "RCM Specialist", clinical_role: "rcm", lands_on: "/clinical?tab=claims" },
  { email: "approver@demo.velomedos.com", role_label: "Approval Officer", clinical_role: "approval_officer", lands_on: "/clinical?tab=claims" },
  { email: "cashier@demo.velomedos.com", role_label: "Cashier", clinical_role: "cashier", lands_on: "/clinical?tab=claims" },
  { email: "biller@demo.velomedos.com", role_label: "Biller", clinical_role: "biller", lands_on: "/clinical?tab=claims" },
  { email: "claims@demo.velomedos.com", role_label: "Claims Officer", clinical_role: "claims_officer", lands_on: "/clinical?tab=claims" },
  { email: "finance@demo.velomedos.com", role_label: "Finance", clinical_role: "finance", lands_on: "/clinical?tab=claims" },
  { email: "readonly@demo.velomedos.com", role_label: "Read-Only Auditor", clinical_role: "read_only", lands_on: "/clinical?tab=encounters" },
  { email: "patient@demo.velomedos.com", role_label: "Patient", clinical_role: null, lands_on: "/patient" },
];

async function requireSuperadminFromHeader(authHeader: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = (authHeader || "").toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, error: "unauthorized" };
  const { data: u } = await supabaseAdmin.auth.getUser(token);
  if (!u?.user) return { ok: false as const, error: "unauthorized" };
  const { data: hasRole } = await supabaseAdmin.rpc("has_role", { _user_id: u.user.id, _role: "superadmin" });
  if (!hasRole) return { ok: false as const, error: "forbidden" };
  return { ok: true as const, userId: u.user.id };
}

async function requireSuperadmin() {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  return requireSuperadminFromHeader(getRequestHeader("authorization") ?? "");
}

/** 20-char password, alphanumeric + 2 punctuation chars, no ambiguous glyphs. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const punct = "!@#$%&*?";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes.slice(0, 18)).map((b) => alphabet[b % alphabet.length]).join("");
  const p1 = punct[bytes[18] % punct.length];
  const p2 = punct[bytes[19] % punct.length];
  // Always finish with at least one letter so credentials work in tools that
  // strip trailing punctuation from copy-paste.
  return body + p1 + p2;
}

async function loadPublicReveal(): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "demo_public_reveal")
    .maybeSingle();
  return data?.value === true || data?.value === "true";
}

/* ============================================================== */
/* SUPERADMIN — full CRUD                                            */
/* ============================================================== */

export const listDemoCredentials = createServerFn({ method: "GET" }).handler(async () => {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("demo_credentials")
    .select("email, role_label, clinical_role, lands_on, sort_order, updated_at, applied_at")
    .order("sort_order", { ascending: true });
  if (error) return { ok: false as const, error: error.message };
  const { data: secrets } = await (supabaseAdmin as any)
    .from("demo_credential_secrets")
    .select("email, password");
  const pwBy = new Map<string, string>((secrets ?? []).map((s: any) => [s.email, s.password as string]));
  const merged = (data ?? []).map((r: any) => ({ ...r, password: pwBy.get(r.email) ?? "" }));
  const reveal = await loadPublicReveal();
  return { ok: true as const, accounts: merged as DemoCredentialRow[], public_reveal: reveal };
});

const RotateOneInput = z.object({ email: z.string().email() });

export const rotateDemoCredential = createServerFn({ method: "POST" })
  .inputValidator((d) => RotateOneInput.parse(d))
  .handler(async ({ data }) => {
    const gate = await requireSuperadmin();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = generatePassword();
    const { error } = await (supabaseAdmin as any)
      .from("demo_credential_secrets")
      .upsert({ email: data.email, password, updated_by: gate.userId, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, email: data.email, password };
  });

export const rotateAllDemoCredentials = createServerFn({ method: "POST" }).handler(async () => {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error: readErr } = await (supabaseAdmin as any)
    .from("demo_credentials")
    .select("email");
  if (readErr) return { ok: false as const, error: readErr.message };
  const updated: Array<{ email: string; password: string }> = [];
  for (const row of rows ?? []) {
    const password = generatePassword();
    const { error } = await (supabaseAdmin as any)
      .from("demo_credential_secrets")
      .upsert({ email: row.email, password, updated_by: gate.userId, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error: `update_failed:${row.email}:${error.message}` };
    updated.push({ email: row.email, password });
  }
  return { ok: true as const, rotated: updated.length, accounts: updated };
});

const SetOneInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const setDemoCredentialPassword = createServerFn({ method: "POST" })
  .inputValidator((d) => SetOneInput.parse(d))
  .handler(async ({ data }) => {
    const gate = await requireSuperadmin();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("demo_credential_secrets")
      .upsert({ email: data.email, password: data.password, updated_by: gate.userId, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, email: data.email };
  });

/** Push every row's password into Supabase Auth so sign-in actually works. */
export const applyCredentialsToAuth = createServerFn({ method: "POST" }).handler(async () => {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("demo_credential_secrets")
    .select("email, password");
  if (error) return { ok: false as const, error: error.message };

  // page through auth users once and build a map
  const userByEmail = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data: list, error: lerr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (lerr) return { ok: false as const, error: `list_users:${lerr.message}` };
    for (const u of list.users) userByEmail.set((u.email ?? "").toLowerCase(), u.id);
    if (!list.users.length || list.users.length < 200) break;
    page += 1;
    if (page > 25) break;
  }

  const synced: Array<{ email: string; status: "synced" | "missing" | "error"; error?: string }> = [];
  for (const row of rows ?? []) {
    const uid = userByEmail.get(row.email.toLowerCase());
    if (!uid) { synced.push({ email: row.email, status: "missing" }); continue; }
    const { error: uerr } = await supabaseAdmin.auth.admin.updateUserById(uid, { password: row.password });
    if (uerr) {
      synced.push({ email: row.email, status: "error", error: uerr.message });
    } else {
      synced.push({ email: row.email, status: "synced" });
      // Stamp applied_at on success so the Superadmin panel's "Apply needed"
      // banner clears for this row. Missing/error rows stay un-stamped so
      // the banner keeps flagging them.
      await (supabaseAdmin as any)
        .from("demo_credentials")
        .update({ applied_at: new Date().toISOString() })
        .eq("email", row.email);
    }
  }
  const ok_count = synced.filter((s) => s.status === "synced").length;
  return { ok: true as const, total: synced.length, synced: ok_count, results: synced };
});

const RevealInput = z.object({ enabled: z.boolean() });

export const setDemoPublicReveal = createServerFn({ method: "POST" })
  .inputValidator((d) => RevealInput.parse(d))
  .handler(async ({ data }) => {
    const gate = await requireSuperadmin();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("platform_settings")
      .upsert({ key: "demo_public_reveal", value: data.enabled, updated_by: gate.userId, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, enabled: data.enabled };
  });

/* ============================================================== */
/* PUBLIC — used by /demo-login and /demo-credentials                */
/* ============================================================== */

/**
 * Anyone can call this. It always returns the account list (email, role
 * label, landing path) so the role selector renders. Passwords are only
 * returned when the operator has flipped `demo_public_reveal` on.
 */
export const getDemoPublicState = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const reveal = await loadPublicReveal();
  const { data, error } = await (supabaseAdmin as any)
    .from("demo_credentials")
    .select("email, role_label, clinical_role, lands_on, sort_order")
    .order("sort_order", { ascending: true });
  if (error) return { ok: true as const, reveal: false, fallback: true, warning: error.message, accounts: FALLBACK_PUBLIC_ACCOUNTS };
  if (!data?.length) return { ok: true as const, reveal: false, fallback: true, warning: "demo_credentials_empty", accounts: FALLBACK_PUBLIC_ACCOUNTS };
  let pwBy = new Map<string, string>();
  if (reveal) {
    const { data: secrets } = await (supabaseAdmin as any).from("demo_credential_secrets").select("email, password");
    pwBy = new Map((secrets ?? []).map((s: any) => [s.email as string, s.password as string]));
  }
  const accounts: DemoPublicAccount[] = (data ?? []).map((r: any) => ({
    email: r.email,
    role_label: r.role_label,
    clinical_role: r.clinical_role,
    lands_on: r.lands_on,
    ...(reveal && pwBy.has(r.email) ? { password: pwBy.get(r.email) as string } : {}),
  }));
  return { ok: true as const, reveal, accounts };
});

/* ============================================================== */
/* HEADER-BASED HELPERS for REST routes                              */
/* ============================================================== */

export async function listDemoCredentialsFromHeader(authHeader: string) {
  const gate = await requireSuperadminFromHeader(authHeader);
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("demo_credentials")
    .select("email, role_label, clinical_role, lands_on, sort_order, updated_at, applied_at")
    .order("sort_order", { ascending: true });
  if (error) return { ok: false as const, error: error.message };
  const { data: secrets } = await (supabaseAdmin as any).from("demo_credential_secrets").select("email, password");
  const pwBy = new Map<string, string>((secrets ?? []).map((s: any) => [s.email, s.password as string]));
  const merged = (data ?? []).map((r: any) => ({ ...r, password: pwBy.get(r.email) ?? "" }));
  const reveal = await loadPublicReveal();
  return { ok: true as const, accounts: merged as DemoCredentialRow[], public_reveal: reveal };
}

export async function getDemoPublicStateRest() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const reveal = await loadPublicReveal();
  const { data, error } = await (supabaseAdmin as any)
    .from("demo_credentials")
    .select("email, role_label, clinical_role, lands_on, sort_order")
    .order("sort_order", { ascending: true });
  if (error) return { ok: true as const, reveal: false, fallback: true, warning: error.message, accounts: FALLBACK_PUBLIC_ACCOUNTS };
  if (!data?.length) return { ok: true as const, reveal: false, fallback: true, warning: "demo_credentials_empty", accounts: FALLBACK_PUBLIC_ACCOUNTS };
  let pwBy = new Map<string, string>();
  if (reveal) {
    const { data: secrets } = await (supabaseAdmin as any).from("demo_credential_secrets").select("email, password");
    pwBy = new Map((secrets ?? []).map((s: any) => [s.email as string, s.password as string]));
  }
  const accounts: DemoPublicAccount[] = (data ?? []).map((r: any) => ({
    email: r.email,
    role_label: r.role_label,
    clinical_role: r.clinical_role,
    lands_on: r.lands_on,
    ...(reveal && pwBy.has(r.email) ? { password: pwBy.get(r.email) as string } : {}),
  }));
  return { ok: true as const, reveal, accounts };
}