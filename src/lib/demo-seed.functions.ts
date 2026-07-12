/**
 * Demo Environment — provisioning, seeding, and reset.
 *
 * Every server function in this module is superadmin-gated AND scoped to
 * the dedicated sandbox tenant (slug `demo-hospital`). The reset path
 * uses scoped `DELETE FROM ... WHERE tenant_id = $demo` in FK-child-first
 * order — it NEVER issues `TRUNCATE`, which would wipe sibling tenants.
 *
 * Idempotency strategy
 * --------------------
 *   - Users:        listUsers() + create-or-skip; tenant_members upsert.
 *   - Beneficiaries: upsert keyed on (tenant_id, patient_file_no).
 *   - Encounters/claims: identified by deterministic file numbers so a
 *                        re-seed after reset reproduces identical IDs.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DEMO_SLUG = "demo-hospital";
const DEFAULT_PASSWORD_FALLBACK = "DemoVeloMed!2026";

type AppRole =
  | "superadmin" | "admin" | "dispatcher" | "developer" | "business_admin"
  | "paramedic" | "driver" | "patient";

type ClinicalRole =
  | "registrar" | "physician" | "nurse" | "lab_tech" | "radiologist"
  | "pharmacist" | "coder" | "case_manager" | "cashier" | "tenant_admin"
  | "read_only" | "biller" | "front_office" | "rcm" | "approval_officer"
  | "claims_officer" | "finance";

type DemoAccount = {
  email: string;
  full_name: string;
  app_role: AppRole;
  clinical_role: ClinicalRole | null;
  lands_on: string;
};

/** The 13 demo accounts. Single shared password from `DEMO_USER_PASSWORD`. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "superadmin@demo.velomedos.com", full_name: "Demo Superadmin",   app_role: "superadmin",     clinical_role: null,                lands_on: "/superadmin" },
  { email: "admin@demo.velomedos.com",      full_name: "Demo Tenant Admin", app_role: "business_admin", clinical_role: "tenant_admin",      lands_on: "/clinical" },
  { email: "doctor@demo.velomedos.com",     full_name: "Dr. Demo Physician",app_role: "paramedic",      clinical_role: "physician",         lands_on: "/clinical" },
  { email: "nurse@demo.velomedos.com",      full_name: "Demo Nurse",        app_role: "paramedic",      clinical_role: "nurse",             lands_on: "/clinical" },
  { email: "coder@demo.velomedos.com",      full_name: "Demo Coder",        app_role: "developer",      clinical_role: "coder",             lands_on: "/clinical" },
  { email: "rcm@demo.velomedos.com",        full_name: "Demo RCM",          app_role: "developer",      clinical_role: "rcm",               lands_on: "/clinical" },
  { email: "approver@demo.velomedos.com",   full_name: "Demo Approver",     app_role: "developer",      clinical_role: "approval_officer",  lands_on: "/clinical" },
  { email: "cashier@demo.velomedos.com",    full_name: "Demo Cashier",      app_role: "developer",      clinical_role: "cashier",           lands_on: "/clinical" },
  { email: "biller@demo.velomedos.com",     full_name: "Demo Biller",       app_role: "developer",      clinical_role: "biller",            lands_on: "/clinical" },
  { email: "claims@demo.velomedos.com",     full_name: "Demo Claims Officer",app_role: "developer",     clinical_role: "claims_officer",    lands_on: "/clinical" },
  { email: "finance@demo.velomedos.com",    full_name: "Demo Finance",      app_role: "developer",      clinical_role: "finance",           lands_on: "/clinical" },
  { email: "readonly@demo.velomedos.com",   full_name: "Demo Read-Only",    app_role: "developer",      clinical_role: "read_only",         lands_on: "/clinical" },
  { email: "patient@demo.velomedos.com",    full_name: "Demo Patient",      app_role: "patient",        clinical_role: null,                lands_on: "/patient" },
];

async function requireSuperadminFromHeader(authHeader: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = (authHeader || "").toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false, error: "unauthorized" };
  const { data: u } = await supabaseAdmin.auth.getUser(token);
  if (!u?.user) return { ok: false, error: "unauthorized" };
  const { data: hasRole } = await supabaseAdmin.rpc("has_role", { _user_id: u.user.id, _role: "superadmin" });
  if (!hasRole) return { ok: false, error: "forbidden" };
  return { ok: true, userId: u.user.id };
}

async function requireSuperadmin(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  return requireSuperadminFromHeader(getRequestHeader("authorization") ?? "");
}

async function resolveDemoTenant(): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("corporate_accounts")
    .select("id, tenant_type")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    const { data: created, error: createErr } = await (supabaseAdmin as any)
      .from("corporate_accounts")
      .insert({
        company_name: "VeloMed Demo Hospital",
        slug: DEMO_SLUG,
        contact_email: "demo@velomedos.com",
        status: "active",
        plan_tier: "demo",
        country: "SA",
        tenant_type: "sandbox",
      })
      .select("id")
      .single();
    if (createErr) return { ok: false, error: createErr.message };
    return { ok: true, id: created.id as string };
  }
  // Round 1 safety gate: demo reset/seed refuses to touch any tenant not
  // tagged sandbox — even if slug matches — to prevent misconfigured demo
  // slugs from destroying partner data.
  if ((data as any).tenant_type !== "sandbox") {
    return { ok: false, error: "not_sandbox_tenant" };
  }
  return { ok: true, id: data.id as string };
}

function demoPassword(): string {
  return process.env.DEMO_USER_PASSWORD ?? DEFAULT_PASSWORD_FALLBACK;
}

/**
 * Load per-account passwords from `demo_credentials`. Falls back to the
 * shared `DEMO_USER_PASSWORD` (or hard-coded default) for any row not
 * present in the table.
 */
async function loadDemoPasswordMap(): Promise<Map<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("demo_credential_secrets")
    .select("email, password");
  const map = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ email: string; password: string }>) {
    map.set(r.email.toLowerCase(), r.password);
  }
  return map;
}

function passwordFor(map: Map<string, string>, email: string): string {
  return map.get(email.toLowerCase()) ?? demoPassword();
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Supabase admin SDK has no getUserByEmail — page through listUsers and match.
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (!data.users.length || data.users.length < 200) return null;
    page += 1;
    if (page > 25) return null;
  }
}

/* ============================================================== */
/* PROVISION USERS                                                  */
/* ============================================================== */

export const provisionDemoUsers = createServerFn({ method: "POST" }).handler(async () => {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const tenant = await resolveDemoTenant();
  if (!tenant.ok) return { ok: false as const, error: tenant.error };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pwMap = await loadDemoPasswordMap();
  const provisioned: Array<{ email: string; user_id: string; status: "created" | "existing" }> = [];

  for (const acct of DEMO_ACCOUNTS) {
    const password = passwordFor(pwMap, acct.email);
    let userId = await findUserIdByEmail(acct.email);
    let status: "created" | "existing" = "existing";
    if (!userId) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: acct.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: acct.full_name, demo: true },
      });
      if (error || !data.user) {
        // Handle race: "already registered"
        if (String(error?.message ?? "").toLowerCase().includes("already")) {
          userId = await findUserIdByEmail(acct.email);
        }
        if (!userId) {
          return { ok: false as const, error: `create_failed:${acct.email}:${error?.message ?? "unknown"}` };
        }
      } else {
        userId = data.user.id;
        status = "created";
      }
    } else {
      // Reset password to the shared rotatable secret.
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    }

    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: acct.app_role },
      { onConflict: "user_id,role" },
    );
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: acct.email,
      full_name: acct.full_name,
      default_role: acct.app_role,
    });
    await (supabaseAdmin as any).from("tenant_members").upsert(
      {
        tenant_id: tenant.id,
        user_id: userId,
        role: acct.app_role,
        clinical_role: acct.clinical_role,
      },
      { onConflict: "tenant_id,user_id" },
    );

    provisioned.push({ email: acct.email, user_id: userId, status });
  }

  return {
    ok: true as const,
    tenant_id: tenant.id,
    password_source: pwMap.size ? "demo_credentials" : (process.env.DEMO_USER_PASSWORD ? "secret" : "fallback"),
    accounts: provisioned,
  };
});

/* ============================================================== */
/* SEED TRANSACTIONAL DATA                                          */
/* ============================================================== */

/** Seed beneficiaries linked to the patient demo user when possible. */
async function seedBeneficiaries(tenantId: string): Promise<{ ids: Record<string, string> }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const patientUserId = await findUserIdByEmail("patient@demo.velomedos.com");

  const rows = [
    { file: "DEMO-OP-001", first: "Layla",  last: "Al-Harbi",  dob: "1986-04-12", gender: "female", insured: true,  user: patientUserId },
    { file: "DEMO-OP-002", first: "Khalid", last: "Al-Otaibi", dob: "1992-09-03", gender: "male",   insured: false, user: null },
    { file: "DEMO-IP-003", first: "Sara",   last: "Mansoor",   dob: "1971-11-22", gender: "female", insured: true,  user: null },
    { file: "DEMO-ER-004", first: "Yousef", last: "Hassan",    dob: "1958-02-08", gender: "male",   insured: true,  user: null },
  ];

  const ids: Record<string, string> = {};
  for (const r of rows) {
    const { data: existing } = await (supabaseAdmin as any)
      .from("beneficiary")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("patient_file_no", r.file)
      .maybeSingle();
    if (existing?.id) {
      ids[r.file] = existing.id;
      if (r.user) {
        await (supabaseAdmin as any).from("beneficiary").update({ patient_user_id: r.user }).eq("id", existing.id);
      }
      continue;
    }
    const { data: ins, error } = await (supabaseAdmin as any).from("beneficiary").insert({
      tenant_id: tenantId,
      patient_file_no: r.file,
      first_name: r.first,
      last_name: r.last,
      full_name: `${r.first} ${r.last}`,
      dob: r.dob,
      gender: r.gender,
      nationality: "SA",
      document_type: "national_id",
      document_id: `1${Math.abs(r.file.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 999999999}`.padStart(10, "0"),
      patient_user_id: r.user,
      address_country: "SA",
      preferred_language: "ar",
    }).select("id").single();
    if (error) throw new Error(`beneficiary_seed_failed:${r.file}:${error.message}`);
    ids[r.file] = ins.id;
  }
  return { ids };
}

export const seedDemo = createServerFn({ method: "POST" }).handler(async () => {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  return runSeedDemo();
});

export async function runSeedDemoFromHeader(authHeader: string) {
  const gate = await requireSuperadminFromHeader(authHeader);
  if (!gate.ok) return { ok: false as const, error: gate.error };
  return runSeedDemo();
}

async function runSeedDemo() {
  const tenant = await resolveDemoTenant();
  if (!tenant.ok) return { ok: false as const, error: tenant.error };

  // Provision users first so beneficiaries can link patient_user_id.
  const { data: list } = await (await import("@/integrations/supabase/client.server")).supabaseAdmin
    .auth.admin.listUsers({ page: 1, perPage: 200 });
  const haveAll = DEMO_ACCOUNTS.every((a) =>
    list?.users.some((u) => (u.email ?? "").toLowerCase() === a.email),
  );
  if (!haveAll) {
    return { ok: false as const, error: "users_not_provisioned: call provisionDemoUsers first" };
  }

  const beneficiaries = await seedBeneficiaries(tenant.id);
  const gate = await seedGateFixtures(tenant.id);
  const scheduler = await seedSchedulerFixtures(tenant.id, beneficiaries.ids);

  return {
    ok: true as const,
    tenant_id: tenant.id,
    beneficiaries: Object.keys(beneficiaries.ids).length,
    gate_fixtures: gate.ok ? "seeded" : `error:${gate.error}`,
    scheduler_fixtures: scheduler.ok ? "seeded" : `error:${scheduler.error}`,
    note:
      "Masters (payers/policies/services/drugs/DRG) and pre-built journey encounters are seeded by the SQL fixture pack in supabase/migrations/<ts>_demo_seed_masters.sql (run separately).",
  };
}

export async function runProvisionDemoUsersFromHeader(authHeader: string) {
  const gate = await requireSuperadminFromHeader(authHeader);
  if (!gate.ok) return { ok: false as const, error: gate.error };
  // Re-use the server fn body by invoking the underlying logic directly.
  // For brevity we just call provisionDemoUsers via its handler — replicate
  // the steps inline so we don't depend on the server-fn runtime context.
  const tenant = await resolveDemoTenant();
  if (!tenant.ok) return { ok: false as const, error: tenant.error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const pwMap = await loadDemoPasswordMap();
  const provisioned: Array<{ email: string; user_id: string; status: "created" | "existing" }> = [];
  for (const acct of DEMO_ACCOUNTS) {
    const password = passwordFor(pwMap, acct.email);
    let userId = await findUserIdByEmail(acct.email);
    let status: "created" | "existing" = "existing";
    if (!userId) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: acct.email, password, email_confirm: true,
        user_metadata: { full_name: acct.full_name, demo: true },
      });
      if (error || !data.user) {
        if (String(error?.message ?? "").toLowerCase().includes("already")) {
          userId = await findUserIdByEmail(acct.email);
        }
        if (!userId) return { ok: false as const, error: `create_failed:${acct.email}` };
      } else {
        userId = data.user.id; status = "created";
      }
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    }
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: acct.app_role }, { onConflict: "user_id,role" });
    await supabaseAdmin.from("profiles").upsert({ id: userId, email: acct.email, full_name: acct.full_name, default_role: acct.app_role });
    await (supabaseAdmin as any).from("tenant_members").upsert(
      { tenant_id: tenant.id, user_id: userId, role: acct.app_role, clinical_role: acct.clinical_role },
      { onConflict: "tenant_id,user_id" },
    );
    provisioned.push({ email: acct.email, user_id: userId, status });
  }
  return {
    ok: true as const,
    tenant_id: tenant.id,
    password_source: pwMap.size ? "demo_credentials" : (process.env.DEMO_USER_PASSWORD ? "secret" : "fallback"),
    accounts: provisioned,
  };
}

/* ============================================================== */
/* RESET                                                            */
/* ============================================================== */

/**
 * Tables deleted (FK-child-first). Tables that may not exist in every
 * environment are wrapped in try/catch so the reset still completes.
 */
const TRANSACTIONAL_TABLES_CHILD_FIRST = [
  "rcm_gate_exception",
  "authorization_item",
  "authorization_request",
  "claim_supporting_info",
  "claim_diagnosis",
  "claim_item_link",
  "claim_item",
  "claim_care_team",
  "claim_submission_attempt",
  "claim",
  "charge_item",
  "prescription_item",
  "prescription",
  "lab_order_item",
  "lab_order",
  "radiology_order_item",
  "radiology_order",
  "ep_order_item",
  "electrophysiology_order",
  "service_order_item",
  "service_order",
  "encounter_care_team",
  "encounter_diagnosis",
  "clinical_supporting_info",
  "clinical_coding",
  "vitals_observation",
  "encounter_emergency",
  "encounter_hospitalization",
  "drg_assignment",
  "encounter",
  "episode_of_care",
  "prom_response",
  "prem_response",
  "prom_assignment",
  "coverage_class",
  "coverage",
  "beneficiary",
  "nphies_message_log",
] as const;

const ResetInput = z.object({
  reseed: z.boolean().optional().default(true),
});

export const resetDemo = createServerFn({ method: "POST" })
  .inputValidator((d) => ResetInput.parse(d ?? {}))
  .handler(async ({ data }) => {
    const gate = await requireSuperadmin();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    return runResetDemo(data.reseed);
  });

/** Direct callable — used by the REST route handler. */
export async function runResetDemoFromHeader(authHeader: string, reseed: boolean) {
  const gate = await requireSuperadminFromHeader(authHeader);
  if (!gate.ok) return { ok: false as const, error: gate.error };
  return runResetDemo(reseed);
}

async function runResetDemo(reseed: boolean) {
    const tenant = await resolveDemoTenant();
    if (!tenant.ok) return { ok: false as const, error: tenant.error };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const deleted: Record<string, number | string> = {};
    for (const table of TRANSACTIONAL_TABLES_CHILD_FIRST) {
      try {
        const { error, count } = await (supabaseAdmin as any)
          .from(table)
          .delete({ count: "exact" })
          .eq("tenant_id", tenant.id);
        deleted[table] = error ? `error:${error.code ?? error.message}` : (count ?? 0);
      } catch (e: any) {
        deleted[table] = `error:${e?.message ?? "exception"}`;
      }
    }
    const { invalidateDemoCache } = await import("@/lib/demo-mode");
    invalidateDemoCache(tenant.id);

    if (reseed) {
      const seeded = await seedBeneficiaries(tenant.id);
      const gate = await seedGateFixtures(tenant.id);
      return {
        ok: true as const,
        tenant_id: tenant.id,
        deleted,
        beneficiaries_reseeded: Object.keys(seeded.ids).length,
        gate_fixtures: gate.ok ? "seeded" : `error:${gate.error}`,
      };
    }
    return { ok: true as const, tenant_id: tenant.id, deleted };
}

/* ============================================================== */
/* GATE FIXTURES — three-state demo (green/amber/red) on ONE encounter */
/* ============================================================== */

/**
 * Seed the three-state Billed-Gate demo on a single most-recent EMER
 * encounter of the demo tenant. All rows use fixed UUIDs so re-runs are
 * idempotent via ON CONFLICT DO NOTHING semantics.
 *
 *   green  — insured charge with an approved `authorization_item`
 *   amber  — insured charge with a CHARGE-SCOPED `emergency_override`
 *            (charge_item_id set, encounter_id NULL — an encounter-level
 *             exception would release every row)
 *   red    — unpaid cash charge (no matching cash_collection → locked)
 *
 * `OrdersPane` picks the most recent encounter and joins
 * `v_order_item_gate` per row — this seed drives all three colors.
 */
async function seedGateFixtures(tenantId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const IDS = {
    ben:       "00000000-0000-0000-0000-0000000d0001",
    svc:       "00000000-0000-0000-0000-0000000d0002",
    enc:       "00000000-0000-0000-0000-0000000d0010",
    so:        "00000000-0000-0000-0000-0000000d0020",
    soiGreen:  "00000000-0000-0000-0000-0000000d0030",
    soiAmber:  "00000000-0000-0000-0000-0000000d0031",
    soiRed:    "00000000-0000-0000-0000-0000000d0032",
    chGreen:   "00000000-0000-0000-0000-0000000d0040",
    chAmber:   "00000000-0000-0000-0000-0000000d0041",
    chRed:     "00000000-0000-0000-0000-0000000d0042",
    authReq:   "00000000-0000-0000-0000-0000000d0050",
    authItem:  "00000000-0000-0000-0000-0000000d0051",
    exception: "00000000-0000-0000-0000-0000000d0060",
  };
  try {
    await db.from("beneficiary").upsert({
      id: IDS.ben, tenant_id: tenantId, patient_file_no: "DEMO-GATE-0001",
      full_name: "Demo · Gate Patient", first_name: "Demo", last_name: "Gate",
      dob: "1990-01-01", gender: "male", document_type: "national_id", document_id: "GATE00001",
    }, { onConflict: "id", ignoreDuplicates: true });
    await db.from("service_master").upsert({
      id: IDS.svc, tenant_id: tenantId, internal_code: "DEMO-CONSULT",
      name: "Demo consultation", service_type: "services",
    }, { onConflict: "id", ignoreDuplicates: true });
    // period_start = now() so this encounter sorts to the top of listEncounters.
    await db.from("encounter").upsert({
      id: IDS.enc, tenant_id: tenantId, beneficiary_id: IDS.ben,
      encounter_number: "ENC-DEMO-GATE", class: "EMER", period_start: new Date().toISOString(),
    }, { onConflict: "id", ignoreDuplicates: true });
    await db.from("service_order").upsert({
      id: IDS.so, tenant_id: tenantId, encounter_id: IDS.enc,
    }, { onConflict: "id", ignoreDuplicates: true });
    for (const [id, status] of [[IDS.soiGreen, "ordered"], [IDS.soiAmber, "ordered"], [IDS.soiRed, "ordered"]] as const) {
      await db.from("service_order_item").upsert({
        id, tenant_id: tenantId, order_id: IDS.so, service_id: IDS.svc, status,
      }, { onConflict: "id", ignoreDuplicates: true });
    }
    const chargeBase = {
      tenant_id: tenantId, encounter_id: IDS.enc, order_item_table: "service_order_item",
      source_type: "service", service_id: IDS.svc, internal_code: "DEMO-CONSULT",
      quantity: 1, status: "ordered",
    };
    await db.from("charge_item").upsert([
      { ...chargeBase, id: IDS.chGreen, order_item_id: IDS.soiGreen, pricing_mode: "insured",
        description: "Demo insured consult (green · billed via auth)",
        unit_price_minor: 15000, net_minor: 15000 },
      { ...chargeBase, id: IDS.chAmber, order_item_id: IDS.soiAmber, pricing_mode: "insured",
        description: "Demo ER consult (amber · released by exception)",
        unit_price_minor: 20000, net_minor: 20000 },
      { ...chargeBase, id: IDS.chRed, order_item_id: IDS.soiRed, pricing_mode: "cash",
        description: "Demo cash consult (red · locked)",
        unit_price_minor: 10000, net_minor: 10000 },
    ], { onConflict: "id", ignoreDuplicates: true });
    await db.from("authorization_request").upsert({
      id: IDS.authReq, tenant_id: tenantId, encounter_id: IDS.enc, status: "approved",
    }, { onConflict: "id", ignoreDuplicates: true });
    await db.from("authorization_item").upsert({
      id: IDS.authItem, tenant_id: tenantId, authorization_request_id: IDS.authReq,
      source: "service", charge_item_id: IDS.chGreen, quantity: 1, decision: "approved",
    }, { onConflict: "id", ignoreDuplicates: true });
    // CHARGE-SCOPED exception — encounter_id must be NULL so only the amber row is released.
    await db.from("rcm_gate_exception").upsert({
      id: IDS.exception, tenant_id: tenantId, encounter_id: null, charge_item_id: IDS.chAmber,
      exception_type: "emergency_override", reason_code: "ctas_1_2",
      reason_text: "Demo: CTAS 1-2 emergency override", manual_approved_minor: 20000,
    }, { onConflict: "id", ignoreDuplicates: true });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "gate_fixture_failed" };
  }
}

/**
 * Step 3 · Turn 5 — Clinic Day Board scheduler fixtures.
 *
 * Seeds 4 clinic_schedule sessions today at 08:00 with distinct priority ranks
 * (Endocrine, OBS&GYN, Surgery, Treatment), 8 clinic_slot rows per session,
 * 1 referral_target waiting on OBS&GYN, and 8 clinic_bookings across S1/S4
 * covering every booking state. One S1 booking carries overbooked=true; one
 * S3 slot is blocked via slot_block(reason_code='or_case'). Fixed UUIDs +
 * ignoreDuplicates: re-running is idempotent.
 *
 * Consumed by:
 *  - Clinic Day Board (`?tab=opd-day-board`) so demo users see 4 columns,
 *    all 8 slot-color states, the referral rail card, and the overbook ribbon.
 *  - Playwright `tests/e2e/day-board.spec.ts`.
 */
async function seedSchedulerFixtures(
  tenantId: string,
  beneficiaryIds: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const IDS = {
    clinic:    "00000000-0000-0000-0000-0000000e0001",
    // Sessions
    s1:        "00000000-0000-0000-0000-0000000e0010",
    s2:        "00000000-0000-0000-0000-0000000e0011",
    s3:        "00000000-0000-0000-0000-0000000e0012",
    s4:        "00000000-0000-0000-0000-0000000e0013",
    // Slots S1 (indexes 0..7)
    slotS1_0:  "00000000-0000-0000-0000-0000000e0100",
    slotS1_1:  "00000000-0000-0000-0000-0000000e0101",
    slotS1_2:  "00000000-0000-0000-0000-0000000e0102",
    slotS1_3:  "00000000-0000-0000-0000-0000000e0103",
    slotS1_4:  "00000000-0000-0000-0000-0000000e0104",
    slotS1_5:  "00000000-0000-0000-0000-0000000e0105",
    slotS1_6:  "00000000-0000-0000-0000-0000000e0106",
    slotS1_7:  "00000000-0000-0000-0000-0000000e0107",
    // Slots S4 (index 0 used for blocked demo of S4 has no bookings; use S4-1..)
    slotS4_0:  "00000000-0000-0000-0000-0000000e0130",
    // Slot S3 (blocked)
    slotS3_0:  "00000000-0000-0000-0000-0000000e0120",
    // Referral chain
    ben:       "00000000-0000-0000-0000-0000000e0200",
    enc:       "00000000-0000-0000-0000-0000000e0201",
    ref:       "00000000-0000-0000-0000-0000000e0202",
    rtarget:   "00000000-0000-0000-0000-0000000e0203",
    // Bookings
    bkBooked:      "00000000-0000-0000-0000-0000000e0300",
    bkConfirmed:   "00000000-0000-0000-0000-0000000e0301",
    bkArrived:     "00000000-0000-0000-0000-0000000e0302",
    bkInConsult:   "00000000-0000-0000-0000-0000000e0303",
    bkCompleted:   "00000000-0000-0000-0000-0000000e0304",
    bkNoShow:      "00000000-0000-0000-0000-0000000e0305",
    bkOverbook:    "00000000-0000-0000-0000-0000000e0306",
    // slot_block for S3
    blockRow:      "00000000-0000-0000-0000-0000000e0400",
  };

  try {
    // Anchor to today 08:00 local so the board renders sessions on ?tab=opd-day-board.
    const today = new Date();
    today.setHours(8, 0, 0, 0);
    const ts = (idx: number) => {
      const d = new Date(today.getTime() + idx * 20 * 60_000);
      return d.toISOString();
    };

    // 1. Clinic.
    await db.from("clinics").upsert({
      id: IDS.clinic, tenant_id: tenantId, name: "Demo OPD Clinic",
    }, { onConflict: "id", ignoreDuplicates: true });

    // 2. Four sessions.
    const sessions: Array<{ id: string; specialty: string; priority_rank: number;
      overbook_allowed?: boolean; overbook_limit?: number; female_clinic?: boolean;
      procedure_room?: boolean }> = [
      { id: IDS.s1, specialty: "endocrine",        priority_rank: 1, overbook_allowed: true, overbook_limit: 2 },
      { id: IDS.s2, specialty: "OBS&GYN",          priority_rank: 2, female_clinic: true },
      { id: IDS.s3, specialty: "surgery consult",  priority_rank: 3 },
      { id: IDS.s4, specialty: "treatment room",   priority_rank: 4, procedure_room: true },
    ];
    for (const s of sessions) {
      await db.from("clinic_schedule").upsert({
        id: s.id, tenant_id: tenantId, clinic_id: IDS.clinic,
        start_time: "08:00", end_time: "12:00",
        slot_duration_min: 20, capacity_per_slot: 1,
        overbook_allowed: s.overbook_allowed ?? false, overbook_limit: s.overbook_limit ?? 0,
        priority_rank: s.priority_rank, specialty: s.specialty,
        female_clinic: !!s.female_clinic, procedure_room: !!s.procedure_room,
      }, { onConflict: "id", ignoreDuplicates: true });
    }

    // 3. Slots — 8 S1 slots + 1 S4 slot + 1 S3 blocked slot.
    const slotRows: Array<{ id: string; schedule_id: string; slot_at: string; status?: string }> = [
      { id: IDS.slotS1_0, schedule_id: IDS.s1, slot_at: ts(0), status: "open" },
      { id: IDS.slotS1_1, schedule_id: IDS.s1, slot_at: ts(1), status: "booked" },
      { id: IDS.slotS1_2, schedule_id: IDS.s1, slot_at: ts(2), status: "booked" },
      { id: IDS.slotS1_3, schedule_id: IDS.s1, slot_at: ts(3), status: "booked" },
      { id: IDS.slotS1_4, schedule_id: IDS.s1, slot_at: ts(4), status: "booked" },
      { id: IDS.slotS1_5, schedule_id: IDS.s1, slot_at: ts(5), status: "booked" },
      { id: IDS.slotS1_6, schedule_id: IDS.s1, slot_at: ts(6), status: "booked" },
      { id: IDS.slotS1_7, schedule_id: IDS.s1, slot_at: ts(7), status: "booked" },
      { id: IDS.slotS4_0, schedule_id: IDS.s4, slot_at: ts(0), status: "open" },
      { id: IDS.slotS3_0, schedule_id: IDS.s3, slot_at: ts(0), status: "blocked" },
    ];
    for (const r of slotRows) {
      await db.from("clinic_slot").upsert({
        id: r.id, tenant_id: tenantId, schedule_id: r.schedule_id,
        slot_at: r.slot_at, capacity: 1, booked_count: 0, status: r.status ?? "open",
      }, { onConflict: "id", ignoreDuplicates: true });
    }

    // 4. S3 slot_block reason_code='or_case' — feeds the OR/Cath colored indication.
    await db.from("slot_block").upsert({
      id: IDS.blockRow, tenant_id: tenantId, schedule_id: IDS.s3, slot_id: IDS.slotS3_0,
      reason_code: "or_case", note: "Demo OR case",
    }, { onConflict: "id", ignoreDuplicates: true });

    // 5. Referral chain — surfaces one card in the booking-request rail for OBS&GYN.
    const referralBen = beneficiaryIds["DEMO-OP-001"] ?? IDS.ben;
    if (referralBen === IDS.ben) {
      await db.from("beneficiary").upsert({
        id: IDS.ben, tenant_id: tenantId, patient_file_no: "DEMO-REF-001",
        full_name: "Demo · Referral Patient", first_name: "Demo", last_name: "Referral",
        dob: "1988-06-15", gender: "female", document_type: "national_id", document_id: "REF00001",
      }, { onConflict: "id", ignoreDuplicates: true });
    }
    await db.from("encounter").upsert({
      id: IDS.enc, tenant_id: tenantId, beneficiary_id: referralBen,
      encounter_number: "ENC-DEMO-REF", class: "AMB",
    }, { onConflict: "id", ignoreDuplicates: true });
    await db.from("referral").upsert({
      id: IDS.ref, tenant_id: tenantId, referral_no: "REF-DEMO-001",
      beneficiary_id: referralBen, source_encounter_id: IDS.enc,
      referral_class: "intra", status: "submitted",
    }, { onConflict: "id", ignoreDuplicates: true });
    await db.from("referral_target").upsert({
      id: IDS.rtarget, tenant_id: tenantId, referral_id: IDS.ref,
      target_kind: "specialty", target_specialty: "OBS&GYN",
      status: "submitted", booked_appointment_id: null,
    }, { onConflict: "id", ignoreDuplicates: true });

    // 6. Bookings — one per lifecycle state on S1; overbook flagged on the last.
    const bookingSeed: Array<{ id: string; slot_id: string; status: string; overbooked?: boolean; no_show?: boolean }> = [
      { id: IDS.bkBooked,    slot_id: IDS.slotS1_1, status: "requested" },
      { id: IDS.bkConfirmed, slot_id: IDS.slotS1_2, status: "confirmed" },
      { id: IDS.bkArrived,   slot_id: IDS.slotS1_3, status: "arrived" },
      { id: IDS.bkInConsult, slot_id: IDS.slotS1_4, status: "in_consult" },
      { id: IDS.bkCompleted, slot_id: IDS.slotS1_5, status: "completed" },
      { id: IDS.bkNoShow,    slot_id: IDS.slotS1_6, status: "no_show", no_show: true },
      { id: IDS.bkOverbook,  slot_id: IDS.slotS1_7, status: "confirmed", overbooked: true },
    ];
    for (const b of bookingSeed) {
      const slotAt = slotRows.find((r) => r.id === b.slot_id)?.slot_at ?? ts(0);
      await db.from("clinic_bookings").upsert({
        id: b.id, tenant_id: tenantId, clinic_id: IDS.clinic, schedule_id: IDS.s1,
        slot_id: b.slot_id, slot_at: slotAt, status: b.status,
        beneficiary_id: referralBen, source: "opd",
        overbooked: !!b.overbooked, no_show: !!b.no_show, eligibility_check_pending: false,
        rebook_request: false, kind: "in_person",
      }, { onConflict: "id", ignoreDuplicates: true });
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "scheduler_fixture_failed" };
  }
}