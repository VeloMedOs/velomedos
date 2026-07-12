/**
 * Regression guard for Round 1 hardening (WW1):
 *   The public entry points `getDemoPublicState` and `getDemoPublicStateRest`
 *   must return the physician row only — superadmin, tenant_admin, and
 *   the 10 other support-role emails must not leak to anonymous callers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const FULL_ROSTER = [
  { email: "superadmin@demo.velomedos.com", role_label: "Demo Superadmin", clinical_role: null, lands_on: "/superadmin", sort_order: 0 },
  { email: "admin@demo.velomedos.com", role_label: "Tenant Admin", clinical_role: "tenant_admin", lands_on: "/clinical", sort_order: 1 },
  { email: "doctor@demo.velomedos.com", role_label: "Physician", clinical_role: "physician", lands_on: "/clinical", sort_order: 2 },
  { email: "nurse@demo.velomedos.com", role_label: "Nurse", clinical_role: "nurse", lands_on: "/clinical", sort_order: 3 },
  { email: "coder@demo.velomedos.com", role_label: "Coder", clinical_role: "coder", lands_on: "/clinical", sort_order: 4 },
  { email: "cashier@demo.velomedos.com", role_label: "Cashier", clinical_role: "cashier", lands_on: "/clinical", sort_order: 5 },
  { email: "patient@demo.velomedos.com", role_label: "Patient", clinical_role: null, lands_on: "/patient", sort_order: 6 },
];

function makeMockClient(rows: typeof FULL_ROSTER, opts: { platformSettingsValue?: unknown } = {}) {
  return {
    from(table: string) {
      if (table === "demo_credentials") {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: rows, error: null }),
          }),
        };
      }
      if (table === "platform_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { value: opts.platformSettingsValue ?? false }, error: null }),
            }),
          }),
        };
      }
      if (table === "demo_credential_secrets") {
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }
      return { select: () => ({ order: () => Promise.resolve({ data: null, error: null }) }) };
    },
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("demo credentials — public physician-only filter (WW1)", () => {
  it("getDemoPublicStateRest returns exactly the physician row", async () => {
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: makeMockClient(FULL_ROSTER),
    }));
    const { getDemoPublicStateRest } = await import("./demo-credentials.functions");
    const res = await getDemoPublicStateRest();
    expect(res.ok).toBe(true);
    expect(res.accounts).toHaveLength(1);
    expect(res.accounts[0].clinical_role).toBe("physician");
    expect(res.accounts[0].email).toBe("doctor@demo.velomedos.com");
    // Regression: no superadmin / tenant admin / support role leakage.
    for (const a of res.accounts) {
      expect(a.email).not.toMatch(/^(superadmin|admin|nurse|coder|cashier|patient)@/);
    }
  });

  it("REST fallback path (empty table) still filters to physician", async () => {
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: makeMockClient([]),
    }));
    const { getDemoPublicStateRest } = await import("./demo-credentials.functions");
    const res = await getDemoPublicStateRest();
    expect(res.accounts).toHaveLength(1);
    expect(res.accounts[0].clinical_role).toBe("physician");
  });

  it("reveal-on path still leaks only physician password", async () => {
    vi.doMock("@/integrations/supabase/client.server", () => ({
      supabaseAdmin: {
        from(table: string) {
          if (table === "demo_credentials") {
            return { select: () => ({ order: () => Promise.resolve({ data: FULL_ROSTER, error: null }) }) };
          }
          if (table === "platform_settings") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { value: true }, error: null }),
                }),
              }),
            };
          }
          if (table === "demo_credential_secrets") {
            return {
              select: () => Promise.resolve({
                data: FULL_ROSTER.map((r) => ({ email: r.email, password: `pw-${r.email}` })),
                error: null,
              }),
            };
          }
          return { select: () => ({ order: () => Promise.resolve({ data: null, error: null }) }) };
        },
      },
    }));
    const { getDemoPublicStateRest } = await import("./demo-credentials.functions");
    const res = await getDemoPublicStateRest();
    expect(res.accounts).toHaveLength(1);
    expect(res.accounts[0].clinical_role).toBe("physician");
    expect(res.accounts[0].password).toBe("pw-doctor@demo.velomedos.com");
  });
});