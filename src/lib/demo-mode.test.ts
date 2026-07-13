// @ts-expect-error bun-types conflicts with project types
import { describe, it, expect, beforeEach, mock } from "bun:test";

// The module under test reads from serviceClient(). We stub the module before
// importing so isDemoTenant / getDemoTenantId hit the stub.

function makeStub(row: { tenant_type?: string; id?: string } | null) {
  return {
    from() {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }),
        }),
      };
    },
  };
}

async function loadFresh(stub: unknown) {
  const path = "@/lib/api-server";
  mock.module(path, () => ({ serviceClient: () => stub, json: () => new Response(), preflight: () => new Response() }));
  // Fresh import so the module-scope cache in demo-mode is reset per case.
  const { isDemoTenant, getDemoTenantId, invalidateDemoCache } =
    await import(`@/lib/demo-mode?${Date.now()}-${Math.random()}`);
  invalidateDemoCache();
  return { isDemoTenant, getDemoTenantId };
}

describe("demo-mode — tenant_type detection", () => {
  beforeEach(() => { delete process.env.DEMO_MODE; });

  it("returns true when tenant_type === 'sandbox'", async () => {
    const { isDemoTenant } = await loadFresh(makeStub({ tenant_type: "sandbox" }));
    expect(await isDemoTenant("tenant-1")).toBe(true);
  });

  it("returns false for partner / production tenants", async () => {
    const { isDemoTenant } = await loadFresh(makeStub({ tenant_type: "production" }));
    expect(await isDemoTenant("tenant-2")).toBe(false);
  });

  it("envForce=true short-circuits to true even for non-sandbox tenants", async () => {
    process.env.DEMO_MODE = "true";
    const { isDemoTenant } = await loadFresh(makeStub({ tenant_type: "production" }));
    expect(await isDemoTenant("tenant-3")).toBe(true);
  });

  it("getDemoTenantId refuses to hand back a non-sandbox row", async () => {
    const { getDemoTenantId } = await loadFresh(makeStub({ id: "abc", tenant_type: "production" }));
    expect(await getDemoTenantId()).toBeNull();
  });

  it("getDemoTenantId returns id when slug row is sandbox", async () => {
    const { getDemoTenantId } = await loadFresh(makeStub({ id: "abc", tenant_type: "sandbox" }));
    expect(await getDemoTenantId()).toBe("abc");
  });
});