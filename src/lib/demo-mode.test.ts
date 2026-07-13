// @ts-expect-error bun-types conflicts with project types
import { describe, it, expect } from "bun:test";
import { computeIsDemo, resolveDemoTenantId } from "@/lib/demo-mode";

describe("demo-mode — computeIsDemo (tenant_type='sandbox')", () => {
  it("returns true for sandbox rows", () => {
    expect(computeIsDemo({ tenant_type: "sandbox" }, false)).toBe(true);
  });
  it("returns false for partner / production rows", () => {
    expect(computeIsDemo({ tenant_type: "partner" }, false)).toBe(false);
    expect(computeIsDemo({ tenant_type: "production" }, false)).toBe(false);
  });
  it("envForce short-circuits to true for any row (or null)", () => {
    expect(computeIsDemo({ tenant_type: "production" }, true)).toBe(true);
    expect(computeIsDemo(null, true)).toBe(true);
  });
  it("null row without force → false", () => {
    expect(computeIsDemo(null, false)).toBe(false);
    expect(computeIsDemo(undefined, false)).toBe(false);
  });
});

describe("demo-mode — resolveDemoTenantId defensive slug check", () => {
  it("returns id when slug row is a sandbox tenant", () => {
    expect(resolveDemoTenantId({ id: "abc", tenant_type: "sandbox" })).toBe("abc");
  });
  it("returns null when slug row is production (guards against slug reuse)", () => {
    expect(resolveDemoTenantId({ id: "abc", tenant_type: "production" })).toBeNull();
  });
  it("returns null when slug row is partner", () => {
    expect(resolveDemoTenantId({ id: "abc", tenant_type: "partner" })).toBeNull();
  });
  it("returns null when the slug lookup returns no row", () => {
    expect(resolveDemoTenantId(null)).toBeNull();
  });
});